// tools/contact.mjs — Contact info tool

import { z } from "zod";
import { waClient, requireConnection, ok, err } from "../lib/client.mjs";

export function registerContactTool(server) {
  server.tool(
    "whatsapp_get_contact_info",
    "Get info about a contact or group",
    { chatId: z.string().describe("Chat ID") },
    async ({ chatId }) => {
      const check = requireConnection();
      if (check) return err(check);
      try {
        const contact = await waClient.getContactById(chatId);
        return ok(JSON.stringify({
          name: contact.name,
          pushname: contact.pushname,
          number: contact.number,
          isGroup: contact.isGroup,
          isBusiness: contact.isBusiness,
          isEnterprise: contact.isEnterprise,
          isMyContact: contact.isMyContact,
        }, null, 2));
      } catch (e) { return err(e.message); }
    },
  );
}
