// lib/config.mjs — Config loading, saving, and paths

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { log } from "./logger.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const projectRoot = join(__dirname, "..");

export const configPath = join(projectRoot, "config.json");
export const qrImagePath = join(projectRoot, "whatsapp-qr.png");
export const authDir = join(projectRoot, ".wwebjs_auth");

/**
 * Load and parse config.json. Returns null if missing/invalid/empty.
 */
export function loadConfig() {
  try {
    const raw = readFileSync(configPath, "utf-8").trim();
    if (!raw || raw === "null" || raw === "{}") return null;
    const cfg = JSON.parse(raw);
    if (!cfg?.profiles || Object.keys(cfg.profiles).length === 0) return null;
    return cfg;
  } catch (_) {
    return null;
  }
}

/**
 * Write config object to config.json.
 */
export function saveConfig(config) {
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  log("Config saved");
}
