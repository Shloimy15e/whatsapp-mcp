// lib/client.mjs — WhatsApp client lifecycle (connect, reconnect, state)

import pkg from "whatsapp-web.js";
const { Client, LocalAuth, NoAuth } = pkg;
import QRCode from "qrcode";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

import { log } from "./logger.mjs";
import { platform, getChromeExecutable, killProcessByName, openFile } from "./platform.mjs";
import { authDir, qrImagePath } from "./config.mjs";

// ── Shared state ──────────────────────────────────────────────
export let waClient = null;
export let status = "not_configured";
export let activeProfileName = null;
export let startTime = null;
export let lastEvent = null;
export let connectionAttempts = 0;

let reconnectTimer = null;
let statusInterval = null;

/** One-line summary for periodic log output. */
export function statusLine() {
  const uptime = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
  return `[WA-MCP] profile=${activeProfileName || "none"} | status=${status} | uptime=${uptime}s | attempts=${connectionAttempts}`;
}

/** Emit a status log on a timer (more frequently while connecting). */
export function startStatusReporting() {
  if (statusInterval) clearInterval(statusInterval);
  statusInterval = setInterval(
    () => log(statusLine()),
    status === "ready" ? 60000 : 15000,
  );
}

/** Quick guard — returns an error string if not connected, or null if OK. */
export function requireConnection() {
  if (!waClient?.pupPage) {
    return `WhatsApp not ready (status: ${status}, profile: ${activeProfileName || "none"}). Use whatsapp_setup switch_profile to connect.`;
  }
  return null;
}

// ── Helpers for MCP tool responses ────────────────────────────
export function ok(text) {
  return { content: [{ type: "text", text }] };
}
export function err(text) {
  return { content: [{ type: "text", text: `Error: ${text}` }], isError: true };
}

// ── Lock-file cleanup ─────────────────────────────────────────
function cleanLocks(sessionDir) {
  for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    try { rmSync(join(sessionDir, f), { force: true }); } catch (_) {}
  }
}

// ── Connect a profile ─────────────────────────────────────────
export async function connectProfile(profileName, profileConfig) {
  // Tear down any previous client
  if (waClient) {
    try { await waClient.destroy(); } catch (_) {}
    waClient = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  activeProfileName = profileName;
  status = "connecting";
  startTime = Date.now();
  connectionAttempts++;
  lastEvent = null;
  log(`Connecting profile "${profileName}" (mode: ${profileConfig.mode})...`);

  const chromeExe = getChromeExecutable();
  if (!chromeExe) {
    status = "error: Chrome/Chromium not found";
    log(status);
    return;
  }

  // Clean up stale Chrome processes / lock files
  if (profileConfig.mode === "local_auth") {
    const sessionDir = join(authDir, profileName, "session");
    mkdirSync(sessionDir, { recursive: true });
    cleanLocks(sessionDir);
    if (platform === "win32") {
      try {
        execSync(
          `wmic process where "name='chrome.exe' and commandline like '%${sessionDir.replace(/\\/g, "\\\\")}%'" call terminate 2>nul`,
          { stdio: "ignore" },
        );
      } catch (_) {}
    } else {
      try { execSync(`pkill -f "${sessionDir}" 2>/dev/null`, { stdio: "ignore" }); } catch (_) {}
    }
  } else {
    killProcessByName("chrome.exe");
  }

  // Puppeteer options
  const puppeteerOpts = {
    headless: profileConfig.mode === "local_auth",
    executablePath: chromeExe,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--disable-extensions",
    ],
  };

  // Client options differ between auth modes
  let clientOpts;
  if (profileConfig.mode === "chrome_profile") {
    puppeteerOpts.args.push(`--profile-directory=${profileConfig.profileId}`);
    puppeteerOpts.args.push(`--user-data-dir=${profileConfig.userDataDir}`);
    clientOpts = {
      authStrategy: new NoAuth(),
      webVersionCache: { type: "none" },
      puppeteer: puppeteerOpts,
    };
  } else {
    clientOpts = {
      authStrategy: new LocalAuth({ dataPath: join(authDir, profileName) }),
      webVersionCache: { type: "none" },
      puppeteer: puppeteerOpts,
    };
  }

  waClient = new Client(clientOpts);

  // Blanket event logging
  for (const evt of ["qr", "authenticated", "ready", "loading_screen", "disconnected", "auth_failure", "change_state"]) {
    waClient.on(evt, (...args) => {
      lastEvent = evt;
      log(`EVENT [${profileName}]: ${evt} ${args.length ? JSON.stringify(args).substring(0, 150) : ""}`);
    });
  }

  // QR handling — save to PNG and open
  waClient.on("qr", async (qr) => {
    status = "qr_pending";
    try {
      await QRCode.toFile(qrImagePath, qr, { width: 400, margin: 2 });
      openFile(qrImagePath);
      log("QR code opened");
    } catch (e) {
      log(`QR error: ${e.message}`);
    }
  });

  waClient.on("authenticated", () => { status = "authenticated"; });
  waClient.on("loading_screen", (pct) => { status = `loading (${pct}%)`; });
  waClient.on("ready", () => { status = "ready"; log(`✓ WhatsApp READY on "${profileName}"`); });
  waClient.on("auth_failure", (msg) => { status = `auth_failed: ${msg}`; });

  // Auto-reconnect
  waClient.on("disconnected", (reason) => {
    status = `disconnected: ${reason}`;
    log(`Disconnected: ${reason}. Reconnecting in 10s...`);
    reconnectTimer = setTimeout(() => {
      if (status.startsWith("disconnected")) {
        log("Auto-reconnecting...");
        connectProfile(profileName, profileConfig);
      }
    }, 10000);
  });

  try {
    await waClient.initialize();
    log("initialize() resolved");
  } catch (error) {
    log(`initialize() error: ${error.message}`);
    status = `error: ${error.message}`;
  }
}
