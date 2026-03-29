// tools/group.mjs — Group management tools

import { z } from "zod";
import { waClient, requireConnection, ok, err } from "../lib/client.mjs";

export function registerGroupTools(server) {
  // ── Get group info ────────────────────────────────────────
  server.tool(
    "whatsapp_get_group_info",
    "Get detailed info about a WhatsApp group",
    { groupId: z.string().describe("Group chat ID") },
    async ({ groupId }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chat = await waClient.getChatById(groupId);
        if (!chat.isGroup) return err("Not a group chat");
        const participants = chat.groupMetadata?.participants?.map((p) => ({
          id: p.id._serialized,
          isAdmin: p.isAdmin,
          isSuperAdmin: p.isSuperAdmin,
        })) || [];
        return ok(JSON.stringify({
          name: chat.name,
          id: chat.id._serialized,
          description: chat.groupMetadata?.desc || "",
          participantCount: participants.length,
          participants: participants.slice(0, 50),
          createdAt: chat.groupMetadata?.creation
            ? new Date(chat.groupMetadata.creation * 1000).toISOString()
            : null,
        }, null, 2));
      } catch (e) { return err(e.message); }
    },
  );

  // ── Create group ──────────────────────────────────────────
  server.tool(
    "whatsapp_create_group",
    "Create a new WhatsApp group",
    {
      name: z.string().describe("Group name"),
      participants: z.array(z.string()).describe("Array of phone numbers with country code (e.g. ['1234567890@c.us'])"),
    },
    async ({ name, participants }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const result = await waClient.createGroup(name, participants);
        return ok(JSON.stringify({
          groupId: result.gid?._serialized,
          title: name,
          missingParticipants: result.missingParticipants,
        }, null, 2));
      } catch (e) { return err(e.message); }
    },
  );

  // ── Add participants ──────────────────────────────────────
  server.tool(
    "whatsapp_group_add_participants",
    "Add participants to a group",
    {
      groupId: z.string().describe("Group chat ID"),
      participants: z.array(z.string()).describe("Array of contact IDs to add"),
    },
    async ({ groupId, participants }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chat = await waClient.getChatById(groupId);
        if (!chat.isGroup) return err("Not a group chat");
        await chat.addParticipants(participants);
        return ok(`Added ${participants.length} participant(s) to ${chat.name}`);
      } catch (e) { return err(e.message); }
    },
  );

  // ── Remove participants ───────────────────────────────────
  server.tool(
    "whatsapp_group_remove_participants",
    "Remove participants from a group",
    {
      groupId: z.string().describe("Group chat ID"),
      participants: z.array(z.string()).describe("Array of contact IDs to remove"),
    },
    async ({ groupId, participants }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chat = await waClient.getChatById(groupId);
        if (!chat.isGroup) return err("Not a group chat");
        await chat.removeParticipants(participants);
        return ok(`Removed ${participants.length} participant(s) from ${chat.name}`);
      } catch (e) { return err(e.message); }
    },
  );

  // ── Leave group ───────────────────────────────────────────
  server.tool(
    "whatsapp_leave_group",
    "Leave a WhatsApp group",
    { groupId: z.string().describe("Group chat ID") },
    async ({ groupId }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const chat = await waClient.getChatById(groupId);
        if (!chat.isGroup) return err("Not a group chat");
        await chat.leave();
        return ok(`Left group ${chat.name}`);
      } catch (e) { return err(e.message); }
    },
  );
}
