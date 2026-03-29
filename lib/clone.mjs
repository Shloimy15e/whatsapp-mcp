// lib/clone.mjs — Clone WhatsApp session data from a Chrome profile

import { existsSync, mkdirSync, cpSync } from "fs";
import { join } from "path";
import { getChromeUserDataDir } from "./platform.mjs";
import { authDir } from "./config.mjs";

/**
 * Clone WhatsApp Web session data from a Chrome profile into a standalone
 * .wwebjs_auth directory for use with LocalAuth mode.
 *
 * Copies: IndexedDB (WA data), Local Storage, Cookies, Session Storage.
 * Returns an array of what was copied, e.g. ["IndexedDB", "Local Storage", "Cookies"].
 */
export function cloneWhatsAppSession(chromeProfileId, targetProfileName) {
  const chromeUserData = getChromeUserDataDir();
  const srcProfile = join(chromeUserData, chromeProfileId);
  const destSession = join(authDir, targetProfileName, "session", "Default");

  if (!existsSync(srcProfile)) {
    throw new Error(`Chrome profile "${chromeProfileId}" not found`);
  }
  mkdirSync(destSession, { recursive: true });

  const copied = [];

  // IndexedDB
  const srcIDB = join(srcProfile, "IndexedDB");
  const destIDB = join(destSession, "IndexedDB");
  mkdirSync(destIDB, { recursive: true });
  for (const dir of [
    "https_web.whatsapp.com_0.indexeddb.leveldb",
    "https_web.whatsapp.com_0.indexeddb.blob",
  ]) {
    const src = join(srcIDB, dir);
    if (existsSync(src)) {
      cpSync(src, join(destIDB, dir), { recursive: true, force: true });
      copied.push(dir);
    }
  }

  // Local Storage
  const srcLS = join(srcProfile, "Local Storage", "leveldb");
  const destLS = join(destSession, "Local Storage", "leveldb");
  if (existsSync(srcLS)) {
    mkdirSync(join(destSession, "Local Storage"), { recursive: true });
    cpSync(srcLS, destLS, { recursive: true, force: true });
    copied.push("Local Storage");
  }

  // Cookies
  for (const f of ["Cookies", "Cookies-journal"]) {
    const src = join(srcProfile, f);
    if (existsSync(src)) {
      cpSync(src, join(destSession, "..", f), { force: true });
      copied.push(f);
    }
  }

  // Session Storage
  const srcSS = join(srcProfile, "Session Storage");
  if (existsSync(srcSS)) {
    cpSync(srcSS, join(destSession, "Session Storage"), { recursive: true, force: true });
    copied.push("Session Storage");
  }

  return copied;
}
