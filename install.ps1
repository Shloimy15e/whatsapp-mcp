# install.ps1 — WhatsApp MCP Installer for Windows (PowerShell)
# Usage: Right-click → Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"
Write-Host "`n=== WhatsApp MCP Installer ===" -ForegroundColor Cyan

# 1. Check Node.js
Write-Host "`nChecking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = & node --version 2>&1
    Write-Host "  Found Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  Node.js not found! Please install it from https://nodejs.org" -ForegroundColor Red
    Write-Host "  (LTS version recommended)" -ForegroundColor Gray
    Read-Host "Press Enter to exit"
    exit 1
}

# 2. Check Chrome
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

# 3. Install npm dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir
$env:PUPPETEER_SKIP_DOWNLOAD = "true"
& npm install 2>&1 | Out-Null
Write-Host "  Dependencies installed" -ForegroundColor Green

# 4. Find Claude Desktop config
Write-Host "`nConfiguring Claude Desktop..." -ForegroundColor Yellow
$serverPath = (Join-Path $scriptDir "server.mjs") -replace '\\', '\\'

# Check both Store and regular install paths
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
    # Try the AppData\Roaming path even if it doesn't exist yet
    $configFile = "$env:APPDATA\Claude\claude_desktop_config.json"
    $configDir = Split-Path -Parent $configFile
    if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
}

Write-Host "  Config: $configFile" -ForegroundColor Gray

if (Test-Path $configFile) {
    $config = Get-Content $configFile -Raw | ConvertFrom-Json
} else {
    $config = [PSCustomObject]@{}
}

if (-not $config.mcpServers) {
    $config | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue ([PSCustomObject]@{})
}

$config.mcpServers | Add-Member -NotePropertyName "whatsapp" -NotePropertyValue ([PSCustomObject]@{
    command = "node"
    args = @($serverPath)
}) -Force

$config | ConvertTo-Json -Depth 10 | Set-Content $configFile -Encoding UTF8
Write-Host "  WhatsApp MCP registered in Claude Desktop" -ForegroundColor Green

# 5. Done
Write-Host "`n=== Installation Complete! ===" -ForegroundColor Cyan
Write-Host "  1. Restart Claude Desktop" -ForegroundColor White
Write-Host "  2. The MCP will auto-detect your WhatsApp Web session from Chrome" -ForegroundColor White
Write-Host "  3. If no session found, ask Claude to run 'whatsapp_setup' to scan or QR-login" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
