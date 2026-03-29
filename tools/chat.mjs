// tools/chat.mjs — Chat tools: list, read, search, send

import { z } from "zod";
import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;
import { waClient, requireConnection, ok, err } from "../lib/client.mjs";

export function registerChatTools(server) {
  // ── List chats ────────────────────────────────────────────
  server.tool(
    "whatsapp_list_chats",
    "List recent WhatsApp chats with unread counts",
    { limit: z.number().optional().describe("Number of chats (default 20)") },
    async ({ limit }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chats = await waClient.getChats();
        return ok(JSON.stringify(
          chats.slice(0, limit || 20).map((c) => ({
            name: c.name,
            id: c.id._serialized,
            isGroup: c.isGroup,
            unreadCount: c.unreadCount,
            lastMessage: c.lastMessage?.body?.substring(0, 100) || "",
            timestamp: c.timestamp ? new Date(c.timestamp * 1000).toISOString() : null,
          })),
          null, 2,
        ));
      } catch (e) { return err(e.message); }
    },
  );

  // ── Read messages ─────────────────────────────────────────
  server.tool(
    "whatsapp_read_messages",
    "Read messages from a chat",
    {
      chatId: z.string().describe("Chat ID"),
      limit: z.number().optional().describe("Number of messages (default 20)"),
    },
    async ({ chatId, limit }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chat = await waClient.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: limit || 20 });
        return ok(JSON.stringify(
          messages.map((m) => ({
            id: m.id._serialized,
            from: m.from,
            fromName: m._data?.notifyName || m.from,
            body: m.body,
            timestamp: new Date(m.timestamp * 1000).toISOString(),
            isForwarded: m.isForwarded,
            hasMedia: m.hasMedia,
            type: m.type,
            hasQuotedMsg: m.hasQuotedMsg,
          })),
          null, 2,
        ));
      } catch (e) { return err(e.message); }
    },
  );

  // ── Search chats ──────────────────────────────────────────
  server.tool(
    "whatsapp_search_chats",
    "Search for a chat by name or phone number",
    { query: z.string().describe("Name or phone number") },
    async ({ query }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chats = await waClient.getChats();
        return ok(JSON.stringify(
          chats
            .filter((c) =>
              c.name?.toLowerCase().includes(query.toLowerCase()) ||
              c.id._serialized.includes(query),
            )
            .slice(0, 10)
            .map((c) => ({ name: c.name, id: c.id._serialized, isGroup: c.isGroup })),
          null, 2,
        ));
      } catch (e) { return err(e.message); }
    },
  );

  // ── Send message ──────────────────────────────────────────
  server.tool(
    "whatsapp_send_message",
    "Send a message (text, reply, or with media)",
    {
      chatId: z.string().describe("Chat ID"),
      message: z.string().describe("Message text"),
      replyToMessageId: z.string().optional().describe("Message ID to reply to"),
      mediaUrl: z.string().optional().describe("URL of image/document/audio to attach"),
      mediaPath: z.string().optional().describe("Local file path of media to attach"),
    },
    async ({ chatId, message, replyToMessageId, mediaUrl, mediaPath }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chat = await waClient.getChatById(chatId);
        const options = {};

        // Reply
        if (replyToMessageId) {
          const messages = await chat.fetchMessages({ limit: 50 });
          const quoted = messages.find((m) => m.id._serialized === replyToMessageId);
          if (quoted) options.quotedMessageId = quoted.id._serialized;
        }

        // Media
        let media = null;
        if (mediaUrl) {
          media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true });
          options.caption = message;
        } else if (mediaPath) {
          media = MessageMedia.fromFilePath(mediaPath);
          options.caption = message;
        }

        if (media) {
          await chat.sendMessage(media, options);
        } else {
          await chat.sendMessage(message, options);
        }
        return ok(`Message sent to ${chat.name}`);
      } catch (e) { return err(e.message); }
    },
  );
}
