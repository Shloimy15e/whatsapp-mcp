// tools/status.mjs — whatsapp_status tool

import { loadConfig } from "../lib/config.mjs";
import { getChromeExecutable, platform } from "../lib/platform.mjs";
import {
  waClient, status, activeProfileName, startTime,
  connectionAttempts, lastEvent, ok,
} from "../lib/client.mjs";

export function registerStatusTool(server) {
  server.tool("whatsapp_status", "Detailed WhatsApp connection status", {}, async () => {
    const config = loadConfig();
    const connected = !!waClient?.pupPage;
    const profiles = config ? Object.keys(config.profiles) : [];
    const uptime = startTime ? `${Math.round((Date.now() - startTime) / 1000)}s` : "n/a";

    return ok([
      `Status: ${status}`,
      `Profile: ${activeProfileName || "none"}`,
      `Connected: ${connected}`,
      `Uptime: ${uptime}`,
      `Attempts: ${connectionAttempts}`,
      `Last event: ${lastEvent || "none"}`,
      `Profiles: ${profiles.join(", ") || "none"}`,
      `Platform: ${platform}`,
      `Chrome: ${getChromeExecutable() || "not found"}`,
    ].join("\n"));
  });
}
