// lib/platform.mjs — Cross-platform helpers (Chrome paths, file opening, process killing)

import { existsSync } from "fs";
import { join } from "path";
import { exec, execSync } from "child_process";
import os from "os";

export const platform = os.platform(); // "win32", "darwin", "linux"

/**
 * Find the Chrome/Chromium executable on this system.
 * Returns the full path or null if not found.
 */
export function getChromeExecutable() {
  const paths = {
    win32: [
      join(process.env["PROGRAMFILES"] || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
      join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
      join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    ],
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      join(os.homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/snap/bin/chromium",
    ],
  };
  for (const p of (paths[platform] || paths.linux)) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Get the Chrome user data directory for the current platform.
 */
export function getChromeUserDataDir() {
  const dirs = {
    win32: join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "User Data"),
    darwin: join(os.homedir(), "Library", "Application Support", "Google", "Chrome"),
    linux: join(os.homedir(), ".config", "google-chrome"),
  };
  return dirs[platform] || dirs.linux;
}

/**
 * Open a file with the system's default application.
 */
export function openFile(filePath) {
  const cmds = {
    win32: `start "" "${filePath}"`,
    darwin: `open "${filePath}"`,
    linux: `xdg-open "${filePath}"`,
  };
  exec(cmds[platform] || cmds.linux);
}

/**
 * Force-kill a process by name (best-effort, ignores errors).
 */
export function killProcessByName(name) {
  try {
    if (platform === "win32") {
      execSync(`taskkill /F /IM ${name} 2>nul`, { stdio: "ignore" });
    } else {
      execSync(`pkill -f ${name} 2>/dev/null`, { stdio: "ignore" });
    }
  } catch (_) {}
}
