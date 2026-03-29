// tools/media.mjs — Media tools: react, forward, download

import { z } from "zod";
import { writeFileSync } from "fs";
import { waClient, requireConnection, ok, err } from "../lib/client.mjs";

export function registerMediaTools(server) {
  // ── React to a message ────────────────────────────────────
  server.tool(
    "whatsapp_react",
    "React to a message with an emoji",
    {
      messageId: z.string().describe("Message ID to react to"),
      chatId: z.string().describe("Chat ID the message is in"),
      emoji: z.string().describe("Emoji to react with (e.g. '👍', '❤️', '😂')"),
    },
    async ({ messageId, chatId, emoji }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chat = await waClient.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: 50 });
        const msg = messages.find((m) => m.id._serialized === messageId);
        if (!msg) return err("Message not found in recent messages");
        await msg.react(emoji);
        return ok(`Reacted with ${emoji}`);
      } catch (e) { return err(e.message); }
    },
  );

  // ── Forward a message ─────────────────────────────────────
  server.tool(
    "whatsapp_forward_message",
    "Forward a message to another chat",
    {
      messageId: z.string().describe("Message ID to forward"),
      fromChatId: z.string().describe("Chat ID the message is in"),
      toChatId: z.string().describe("Chat ID to forward to"),
    },
    async ({ messageId, fromChatId, toChatId }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chat = await waClient.getChatById(fromChatId);
        const messages = await chat.fetchMessages({ limit: 50 });
        const msg = messages.find((m) => m.id._serialized === messageId);
        if (!msg) return err("Message not found");
        await msg.forward(toChatId);
        return ok("Message forwarded");
      } catch (e) { return err(e.message); }
    },
  );

  // ── Download media ────────────────────────────────────────
  server.tool(
    "whatsapp_download_media",
    "Download media from a message and save to a file",
    {
      messageId: z.string().describe("Message ID with media"),
      chatId: z.string().describe("Chat ID the message is in"),
      savePath: z.string().optional().describe("File path to save media (optional, returns base64 if not provided)"),
    },
    async ({ messageId, chatId, savePath }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chat = await waClient.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: 50 });
        const msg = messages.find((m) => m.id._serialized === messageId);
        if (!msg) return err("Message not found");
        if (!msg.hasMedia) return err("Message has no media");
        const media = await msg.downloadMedia();
        if (!media) return err("Failed to download media");

        if (savePath) {
          const buffer = Buffer.from(media.data, "base64");
          writeFileSync(savePath, buffer);
          return ok(`Media saved to ${savePath} (${media.mimetype}, ${buffer.length} bytes)`);
        }
        return ok(JSON.stringify({
          mimetype: media.mimetype,
          filename: media.filename,
          size: media.data.length,
          data: media.data.substring(0, 100) + "...",
        }));
      } catch (e) { return err(e.message); }
    },
  );
}
