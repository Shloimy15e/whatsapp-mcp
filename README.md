# WhatsApp MCP for Claude Desktop

Connect Claude Desktop to WhatsApp. Send & receive messages, manage groups, share media — all through natural conversation with Claude.

## Features

- **Zero-config first launch** — auto-detects your WhatsApp Web session from Chrome
- **Multi-profile** — switch between WhatsApp accounts
- **Full messaging** — send, read, search, reply, forward, react
- **Media support** — send images/documents, download attachments
- **Group management** — create groups, add/remove members, get info
- **Cross-platform** — Windows, macOS, Linux
- **Auto-reconnect** — recovers from disconnections automatically

## Quick Install

### Windows

```powershell
git clone https://github.com/YOUR_USERNAME/whatsapp-mcp.git
cd whatsapp-mcp
powershell -ExecutionPolicy Bypass -File install.ps1
```

### macOS / Linux

```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-mcp.git
cd whatsapp-mcp
chmod +x install.sh && ./install.sh
```

### Manual Install

1. Clone this repo and `cd` into it
2. Run `PUPPETEER_SKIP_DOWNLOAD=true npm install`
3. Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/full/path/to/whatsapp-mcp/server.mjs"]
    }
  }
}
```

4. Restart Claude Desktop

## Requirements

- **Node.js** 18+ ([download](https://nodejs.org))
- **Google Chrome** (used by the WhatsApp Web engine)
- **Claude Desktop** ([download](https://claude.ai/download))

## How It Works

On first launch, the MCP server:

1. Scans your Chrome profiles for an existing WhatsApp Web session
2. If found, clones the session data so Chrome doesn't need to stay open
3. Connects to WhatsApp headlessly (no visible browser window)
4. If no session is found, you can ask Claude to set up a new one via QR code

## Available Tools

| Tool | Description |
|------|-------------|
| `whatsapp_setup` | Manage profiles (add, remove, switch, scan Chrome, clone session) |
| `whatsapp_status` | Connection status, uptime, platform info |
| `whatsapp_list_chats` | List recent chats with unread counts |
| `whatsapp_read_messages` | Read messages from a chat |
| `whatsapp_search_chats` | Search chats by name or number |
| `whatsapp_send_message` | Send text, reply, or media messages |
| `whatsapp_react` | React to a message with an emoji |
| `whatsapp_forward_message` | Forward a message to another chat |
| `whatsapp_download_media` | Download media attachments |
| `whatsapp_get_contact_info` | Get contact details |
| `whatsapp_get_group_info` | Get group details and participants |
| `whatsapp_create_group` | Create a new group |
| `whatsapp_group_add_participants` | Add members to a group |
| `whatsapp_group_remove_participants` | Remove members from a group |
| `whatsapp_leave_group` | Leave a group |

## Project Structure

```
whatsapp-mcp/
├── server.mjs          # Entry point — MCP server setup & auto-connect
├── lib/
│   ├── logger.mjs      # Logging & crash handlers
│   ├── platform.mjs    # Cross-platform helpers (Chrome paths, OS utils)
│   ├── config.mjs      # Config file management
│   ├── chrome.mjs      # Chrome profile detection
│   ├── clone.mjs       # Session cloning from Chrome
│   └── client.mjs      # WhatsApp client lifecycle & state
├── tools/
│   ├── setup.mjs       # Profile management tool
│   ├── status.mjs      # Connection status tool
│   ├── chat.mjs        # Chat tools (list, read, search, send)
│   ├── media.mjs       # Media tools (react, forward, download)
│   ├── contact.mjs     # Contact info tool
│   └── group.mjs       # Group management tools
├── install.ps1         # Windows installer
├── install.sh          # macOS/Linux installer
├── package.json
└── config.json         # Auto-generated profile config
```

## Troubleshooting

**"Chrome not found"** — Install Google Chrome, or set the path manually in `lib/platform.mjs`.

**QR code won't scan** — Make sure Chrome is fully closed (check Task Manager / Activity Monitor). The WhatsApp Web engine needs exclusive access.

**"WhatsApp not ready"** — Ask Claude to run `whatsapp_status` for details. Try `whatsapp_setup switch_profile name:default` to reconnect.

**Session expired** — WhatsApp sessions expire after ~2 weeks of inactivity. Delete the `.wwebjs_auth` folder and re-authenticate.

## License

MIT
