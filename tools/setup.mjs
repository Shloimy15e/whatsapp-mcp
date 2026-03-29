// tools/setup.mjs — whatsapp_setup tool (profile management)

import { z } from "zod";
import { loadConfig, saveConfig } from "../lib/config.mjs";
import { findChromeProfiles } from "../lib/chrome.mjs";
import { cloneWhatsAppSession } from "../lib/clone.mjs";
import { connectProfile, ok, err, status } from "../lib/client.mjs";

export function registerSetupTool(server) {
  server.tool(
    "whatsapp_setup",
    "Manage WhatsApp profiles. Create, list, remove profiles or switch between them.",
    {
      action: z.enum([
        "list_profiles",
        "add_chrome_profile",
        "add_qr_profile",
        "remove_profile",
        "switch_profile",
        "scan_chrome",
        "clone_session",
      ]).describe("Action to perform"),
      name: z.string().optional().describe("Profile name (for add/remove/switch/clone actions)"),
      chromeProfileId: z.string().optional().describe("Chrome profile ID e.g. 'Default' or 'Profile 1' (for add_chrome_profile or clone_session)"),
    },
    async ({ action, name, chromeProfileId }) => {
      const config = loadConfig() || { activeProfile: null, profiles: {} };

      if (action === "scan_chrome") {
        const profiles = findChromeProfiles();
        if (profiles.length === 0) return ok("No Chrome profiles found on this system.");
        const list = profiles
          .map((p) => `• ${p.id} — "${p.displayName}" ${p.hasWhatsApp ? "✓ Has WhatsApp" : ""}`)
          .join("\n");
        return ok(`Chrome profiles found:\n${list}\n\nUse add_chrome_profile or clone_session to use one.`);
      }

      if (action === "list_profiles") {
        const names = Object.keys(config.profiles);
        if (names.length === 0) {
          return ok("No profiles configured. Use scan_chrome, add_chrome_profile, or add_qr_profile to get started.");
        }
        const list = names
          .map((n) => {
            const p = config.profiles[n];
            const active = n === config.activeProfile ? " ← ACTIVE" : "";
            const mode = p.mode === "chrome_profile"
              ? `Chrome (${p.displayName || p.profileId})`
              : "QR Auth";
            return `• ${n} — ${mode}${active}`;
          })
          .join("\n");
        return ok(`Profiles:\n${list}\n\nActive: ${config.activeProfile || "none"} | Status: ${status}`);
      }

      if (action === "add_chrome_profile") {
        if (!name || !chromeProfileId) return err("Both 'name' and 'chromeProfileId' are required.");
        const match = findChromeProfiles().find((p) => p.id === chromeProfileId);
        if (!match) return err(`Chrome profile "${chromeProfileId}" not found.`);
        config.profiles[name] = {
          mode: "chrome_profile",
          profileId: match.id,
          userDataDir: match.userDataDir,
          displayName: match.displayName,
          hasWhatsApp: match.hasWhatsApp,
        };
        if (!config.activeProfile) config.activeProfile = name;
        saveConfig(config);
        return ok(`Profile "${name}" added (Chrome: ${match.displayName}). ${match.hasWhatsApp ? "✓ WhatsApp session found." : ""}`);
      }

      if (action === "add_qr_profile") {
        if (!name) return err("'name' is required.");
        config.profiles[name] = { mode: "local_auth", label: name };
        if (!config.activeProfile) config.activeProfile = name;
        saveConfig(config);
        return ok(`Profile "${name}" added (QR auth mode).`);
      }

      if (action === "remove_profile") {
        if (!name || !config.profiles[name]) return err(`Profile "${name}" not found.`);
        delete config.profiles[name];
        if (config.activeProfile === name) {
          config.activeProfile = Object.keys(config.profiles)[0] || null;
        }
        saveConfig(config);
        return ok(`Profile "${name}" removed.`);
      }

      if (action === "clone_session") {
        if (!name || !chromeProfileId) return err("Both 'name' and 'chromeProfileId' are required.");
        if (!config.profiles[name]) {
          config.profiles[name] = { mode: "local_auth", label: name };
          config.activeProfile = config.activeProfile || name;
          saveConfig(config);
        }
        if (config.profiles[name].mode !== "local_auth") {
          return err("Can only clone into local_auth profiles.");
        }
        try {
          const copied = cloneWhatsAppSession(chromeProfileId, name);
          return ok(`Session cloned: ${copied.join(", ")}. Use switch_profile to connect.`);
        } catch (e) {
          return err(`Clone failed: ${e.message}`);
        }
      }

      if (action === "switch_profile") {
        if (!name || !config.profiles[name]) return err(`Profile "${name}" not found.`);
        config.activeProfile = name;
        saveConfig(config);
        await connectProfile(name, config.profiles[name]);
        return ok(`Switched to "${name}". Status: ${status}`);
      }

      return err("Unknown action");
    },
  );
}
