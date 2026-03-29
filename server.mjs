// server.mjs — WhatsApp MCP Server v3.0 (modular entry point)
//
// Architecture:
//   lib/logger.mjs    – logging & crash handlers
//   lib/platform.mjs  – cross-platform Chrome/OS helpers
//   lib/config.mjs    – config.json load/save
//   lib/chrome.mjs    – Chrome profile scanning
//   lib/clone.mjs     – session cloning from Chrome → .wwebjs_auth
//   lib/client.mjs    – WhatsApp client lifecycle & shared state
//   tools/setup.mjs   – profile management tool
//   tools/status.mjs  – connection status tool
//   tools/chat.mjs    – list, read, search, send messages
//   tools/media.mjs   – reactions, forwarding, media download
//   tools/contact.mjs – contact info
//   tools/group.mjs   – group management

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync } from "fs";
import { join } from "path";

// ── Lib imports ─────────────────────────────────────────────
import { log } from "./lib/logger.mjs";
import { platform, getChromeExecutable } from "./lib/platform.mjs";
import { loadConfig, saveConfig, authDir } from "./lib/config.mjs";
import { findChromeProfiles } from "./lib/chrome.mjs";
import { cloneWhatsAppSession } from "./lib/clone.mjs";
import { connectProfile, startStatusReporting } from "./lib/client.mjs";

// ── Tool registrations ──────────────────────────────────────
import { registerSetupTool } from "./tools/setup.mjs";
import { registerStatusTool } from "./tools/status.mjs";
import { registerChatTools } from "./tools/chat.mjs";
import { registerMediaTools } from "./tools/media.mjs";
import { registerContactTool } from "./tools/contact.mjs";
import { registerGroupTools } from "./tools/group.mjs";

// ── MCP Server ──────────────────────────────────────────────
const server = new McpServer({ name: "whatsapp", version: "3.0.0" });

registerSetupTool(server);
registerStatusTool(server);
registerChatTools(server);
registerMediaTools(server);
registerContactTool(server);
registerGroupTools(server);

// ── Startup / Auto-setup ────────────────────────────────────
log("=== WhatsApp MCP Server v3.0 ===");
log(`Platform: ${platform} | Chrome: ${getChromeExecutable() || "NOT FOUND"}`);

function autoSetup() {
  let config = loadConfig();

  if (!config) {
    log("No config found. Running auto-setup...");
    const chromeProfiles = findChromeProfiles();
    const waProfile = chromeProfiles.find((p) => p.hasWhatsApp);
    config = {
      activeProfile: "default",
      profiles: { default: { mode: "local_auth", label: "default" } },
    };
    if (waProfile) {
      log(`Found WhatsApp in Chrome "${waProfile.displayName}". Auto-cloning...`);
      try {
        const c = cloneWhatsAppSession(waProfile.id, "default");
        log(`Cloned: ${c.join(", ")}`);
      } catch (e) {
        log(`Auto-clone failed: ${e.message}`);
      }
    }
    saveConfig(config);
  }

  if (config.activeProfile && config.profiles[config.activeProfile]) {
    const name = config.activeProfile;
    const profile = config.profiles[name];

    // If local_auth mode but no session data yet, try auto-cloning
    if (profile.mode === "local_auth") {
      const sessionDefault = join(authDir, name, "session", "Default");
      if (!existsSync(sessionDefault)) {
        const waProfile = findChromeProfiles().find((p) => p.hasWhatsApp);
        if (waProfile) {
          log(`No session data for "${name}". Auto-cloning...`);
          try { cloneWhatsAppSession(waProfile.id, name); } catch (e) { log(`Clone failed: ${e.message}`); }
        }
      }
    }

    log(`Auto-connecting "${name}"...`);
    connectProfile(name, profile);
  }
}

autoSetup();
startStatusReporting();

const transport = new StdioServerTransport();
await server.connect(transport);
