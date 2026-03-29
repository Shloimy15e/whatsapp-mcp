// lib/chrome.mjs — Chrome profile detection & WhatsApp session discovery

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getChromeUserDataDir } from "./platform.mjs";
import { log } from "./logger.mjs";

/**
 * Scan Chrome user-data directory for profiles.
 * Returns an array of { id, displayName, userDataDir, hasWhatsApp }.
 */
export function findChromeProfiles() {
  const chromeUserData = getChromeUserDataDir();
  if (!existsSync(chromeUserData)) return [];

  const profiles = [];
  try {
    for (const entry of readdirSync(chromeUserData, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name !== "Default" && !name.startsWith("Profile ")) continue;

      let displayName = name;
      try {
        const prefs = JSON.parse(readFileSync(join(chromeUserData, name, "Preferences"), "utf-8"));
        displayName = prefs?.profile?.name || name;
      } catch (_) {}

      const waDB = join(chromeUserData, name, "IndexedDB", "https_web.whatsapp.com_0.indexeddb.leveldb");
      profiles.push({
        id: name,
        displayName,
        userDataDir: chromeUserData,
        hasWhatsApp: existsSync(waDB),
      });
    }
  } catch (e) {
    log(`Error scanning profiles: ${e.message}`);
  }
  return profiles;
}
