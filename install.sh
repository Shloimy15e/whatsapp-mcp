#!/usr/bin/env bash
# install.sh — WhatsApp MCP Installer for macOS / Linux
# Usage: chmod +x install.sh && ./install.sh

set -e
echo ""
echo "=== WhatsApp MCP Installer ==="
echo ""

# 1. Check Node.js
echo "Checking Node.js..."
if command -v node &>/dev/null; then
    echo "  Found Node.js $(node --version)"
else
    echo "  Node.js not found! Please install it from https://nodejs.org"
    exit 1
fi

# 2. Check Chrome / Chromium
echo "Checking Chrome..."
CHROME=""
for path in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/usr/bin/google-chrome" \
    "/usr/bin/google-chrome-stable" \
    "/usr/bin/chromium-browser" \
    "/usr/bin/chromium" \
    "/snap/bin/chromium"; do
    if [ -f "$path" ]; then
        CHROME="$path"
        break
    fi
done

if [ -z "$CHROME" ]; then
    echo "  Chrome/Chromium not found! Please install Google Chrome."
    exit 1
fi
echo "  Found Chrome at $CHROME"

# 3. Install npm dependencies
echo ""
echo "Installing dependencies..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
PUPPETEER_SKIP_DOWNLOAD=true npm install --silent
echo "  Dependencies installed"

# 4. Configure Claude Desktop
echo ""
echo "Configuring Claude Desktop..."
SERVER_PATH="$SCRIPT_DIR/server.mjs"

# Detect config location
if [ "$(uname)" = "Darwin" ]; then
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
else
    CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/Claude"
fi
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

mkdir -p "$CONFIG_DIR"

if [ -f "$CONFIG_FILE" ]; then
    # Merge into existing config using node
    node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf-8'));
if (!cfg.mcpServers) cfg.mcpServers = {};
cfg.mcpServers.whatsapp = { command: 'node', args: ['$SERVER_PATH'] };
fs.writeFileSync('$CONFIG_FILE', JSON.stringify(cfg, null, 2));
"
else
    # Create fresh config
    cat > "$CONFIG_FILE" <<CONF
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["$SERVER_PATH"]
    }
  }
}
CONF
fi
echo "  WhatsApp MCP registered in Claude Desktop"

# 5. Done
echo ""
echo "=== Installation Complete! ==="
echo "  1. Restart Claude Desktop"
echo "  2. The MCP will auto-detect your WhatsApp Web session from Chrome"
echo "  3. If no session found, ask Claude to run 'whatsapp_setup' to scan or QR-login"
echo ""
