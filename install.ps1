# install.ps1 - WhatsApp MCP Installer for Windows (PowerShell)
# Usage: Right-click > Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File install.ps1

# Use "Continue" globally so stderr from native commands (node, npm) doesn't
# become a terminating error.  We check $LASTEXITCODE explicitly instead.
$ErrorActionPreference = "Continue"

Write-Host "`n=== WhatsApp MCP Installer ===" -ForegroundColor Cyan

# -- 1. Check Node.js ------------------------------------------------------------------------------------------------------------------------------------------------
Write-Host "`nChecking Node.js..." -ForegroundColor Yellow
$nodeOutput = & node --version 2>&1
if ($LASTEXITCODE -ne 0 -or -not $nodeOutput) {
    Write-Host "  Node.js not found! Please install it from https://nodejs.org" -ForegroundColor Red
    Write-Host "  (LTS version recommended)" -ForegroundColor Gray
    Read-Host "Press Enter to exit"
    exit 1
}
$nodeVersion = ($nodeOutput | Out-String).Trim()
Write-Host "  Found Node.js $nodeVersion" -ForegroundColor Green

# -- 2. Check Chrome ---------------------------------------------------------------------------------------------------------------------------------------------------
Write-Host "Checking Chrome..." -ForegroundColor Yellow
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromeFound = $false
foreach ($p in $chromePaths) {
    if (Test-Path $p) {
        Write-Host "  Found Chrome at $p" -ForegroundColor Green
        $chromeFound = $true
        break
    }
}
if (-not $chromeFound) {
    Write-Host "  Chrome not found! Please install Google Chrome." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# -- 3. Install npm dependencies ---------------------------------------------------------------------------------------------------------------
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir
$env:PUPPETEER_SKIP_DOWNLOAD = "true"

# Remove corrupted lockfile if present so npm can regenerate cleanly
$lockFile = Join-Path $scriptDir "package-lock.json"
if (Test-Path $lockFile) {
    $lockContent = Get-Content $lockFile -Raw 2>$null
    if ($lockContent -match '"version"\s*:\s*""' -or $lockContent -match '"optional"\s*:\s*true\s*\}') {
        Write-Host "  Detected corrupted package-lock.json, regenerating..." -ForegroundColor Yellow
        Remove-Item $lockFile -Force
    }
}

# Capture all output (stdout + stderr) so warnings don't pollute the console
$npmOutput = & npm install 2>&1 | Out-String

if ($LASTEXITCODE -ne 0) {
    Write-Host "  npm install failed (exit code $LASTEXITCODE):" -ForegroundColor Red
    Write-Host $npmOutput -ForegroundColor Gray
    Read-Host "Press Enter to exit"
    exit 1
}

# Show any warnings in gray so the user is aware but not alarmed
$warnings = ($npmOutput -split "`n") | Where-Object { $_ -match "WARN" }
if ($warnings) {
    Write-Host "  (npm warnings - safe to ignore):" -ForegroundColor Gray
    foreach ($w in $warnings) { Write-Host "    $w" -ForegroundColor DarkGray }
}
Write-Host "  Dependencies installed" -ForegroundColor Green

# -- 4. Ask user to close Claude Desktop before writing config -----------------
Write-Host "`nConfiguring Claude..." -ForegroundColor Yellow
$serverPath = (Join-Path $scriptDir "server.mjs") -replace '\\', '\\'

# Check if Claude Desktop is running - it overwrites the config on exit
$claudeRunning = Get-Process -Name "Claude" -ErrorAction SilentlyContinue
if ($claudeRunning) {
    Write-Host "  Claude Desktop is currently running." -ForegroundColor Yellow
    Write-Host "  It must be fully closed before we can update the config," -ForegroundColor Yellow
    Write-Host "  otherwise it will overwrite our changes on exit." -ForegroundColor Yellow
    Write-Host ""
    $choice = Read-Host "  Close Claude Desktop now? (Y/n)"
    if ($choice -eq "" -or $choice -match "^[Yy]") {
        Write-Host "  Closing Claude Desktop..." -ForegroundColor Yellow
        Stop-Process -Name "Claude" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        # Double-check it's gone
        $stillRunning = Get-Process -Name "Claude" -ErrorAction SilentlyContinue
        if ($stillRunning) {
            Write-Host "  Could not close Claude Desktop. Please close it manually and re-run." -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
        Write-Host "  Claude Desktop closed." -ForegroundColor Green
    } else {
        Write-Host "  Skipping config update. You will need to add the MCP manually." -ForegroundColor Yellow
        Write-Host "  See README.md for manual setup instructions." -ForegroundColor Gray
    }
}

# -- 4a. Claude Desktop config ------------------------------------------------
$configPaths = @(
    "$env:APPDATA\Claude\claude_desktop_config.json",
    "$env:LOCALAPPDATA\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json"
)

$configFile = $null
foreach ($cp in $configPaths) {
    if (Test-Path $cp) {
        $configFile = $cp
        break
    }
}

if (-not $configFile) {
    $configFile = "$env:APPDATA\Claude\claude_desktop_config.json"
    $configDir = Split-Path -Parent $configFile
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
}

Write-Host "  Config: $configFile" -ForegroundColor Gray

try {
    if (Test-Path $configFile) {
        $raw = Get-Content $configFile -Raw

        # Back up the existing config before modifying
        $backupFile = "$configFile.bak"
        Copy-Item $configFile $backupFile -Force
        Write-Host "  Backed up existing config to $backupFile" -ForegroundColor Gray

        $config = $raw | ConvertFrom-Json
    } else {
        $config = [PSCustomObject]@{}
    }

    if (-not $config.mcpServers) {
        $config | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue ([PSCustomObject]@{})
    }

    $mcpEntry = [PSCustomObject]@{
        command = "node"
        args = @($serverPath)
    }
    $config.mcpServers | Add-Member -NotePropertyName "whatsapp" -NotePropertyValue $mcpEntry -Force

    $json = $config | ConvertTo-Json -Depth 10
    # Write UTF-8 WITHOUT BOM - Claude Desktop cannot parse a BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($configFile, $json, $utf8NoBom)

    # Verify the write produced valid JSON and the entry is there
    $verifyRaw = [System.IO.File]::ReadAllText($configFile, $utf8NoBom)
    $verify = $verifyRaw | ConvertFrom-Json
    if ($verify.mcpServers.whatsapp) {
        Write-Host "  WhatsApp MCP registered in Claude Desktop" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: MCP entry missing after write. Restoring backup..." -ForegroundColor Red
        if (Test-Path $backupFile) { Copy-Item $backupFile $configFile -Force }
        Write-Host "  Backup restored. Please add the MCP manually - see README.md" -ForegroundColor Red
    }
} catch {
    Write-Host "  Failed to update config: $_" -ForegroundColor Red
    # Restore backup if we have one
    $backupFile = "$configFile.bak"
    if (Test-Path $backupFile) {
        Copy-Item $backupFile $configFile -Force
        Write-Host "  Restored backup config." -ForegroundColor Yellow
    }
    Write-Host "  You can add it manually - see README.md" -ForegroundColor Gray
}

# -- 5. Done -------------------------------------------------------------------
Write-Host "`n=== Installation Complete! ===" -ForegroundColor Cyan
Write-Host "  1. Open (or restart) Claude Desktop" -ForegroundColor White
Write-Host "  2. The MCP will auto-detect your WhatsApp Web session from Chrome" -ForegroundColor White
Write-Host "  3. If no session found, ask Claude to run 'whatsapp_setup' to scan or QR-login" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
