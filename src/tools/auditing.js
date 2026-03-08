import { z } from "zod";

export function registerAuditingTools(server, client) {
  // ── list_activities ───────────────────────────────────────────────────
  server.registerTool(
    "list_activities",
    {
      title: "List Activities",
      description:
        "Returns activity / audit logs with optional filters for identifier, username, action type, resource, date range, and pagination.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        identifier: z.string().optional().describe("Filter by identifier"),
        username: z.string().optional().describe("Filter by username"),
        action: z
          .array(z.number().int())
          .optional()
          .describe("Filter by action types: 1=POST, 2=PUT, 3=DELETE, 4=PATCH"),
        resource: z.string().optional().describe("Filter by resource (JSON)"),
        begin: z
          .string()
          .optional()
          .describe("Filter activities after this date (ISO 8601)"),
        end: z
          .string()
          .optional()
          .describe("Filter activities before this date (ISO 8601)"),
        skip: z.number().int().optional().describe("Documents to skip"),
        limit: z.number().int().optional().describe("Max documents to return"),
      }),
    },
    async ({
      identifier,
      username,
      action,
      resource,
      begin,
      end,
      skip,
      limit,
    }) => {
      const data = await client.get("/activity", {
        identifier,
        username,
        action,
        resource,
        begin,
        end,
        skip,
        limit,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
