// lib/logger.mjs — Centralized logging & crash handlers

export const log = (msg) => console.error(`[${new Date().toISOString()}] ${msg}`);

process.on("uncaughtException", (err) => log(`UNCAUGHT: ${err.message}\n${err.stack}`));
process.on("unhandledRejection", (err) => log(`UNHANDLED: ${err?.message || err}\n${err?.stack}`));
