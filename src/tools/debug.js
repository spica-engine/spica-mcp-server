import { z } from "zod";

export function registerDebugTools(server, client) {
  // ── list_bucket_data_profile ──────────────────────────────────────────
  server.registerTool(
    "list_bucket_data_profile",
    {
      title: "List Bucket Data Profile",
      description:
        "Returns profiled entries for bucket data. Useful for debugging data distribution and patterns.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        bucketId: z.string().describe("Bucket ID"),
        filter: z.string().optional().describe("JSON filter object"),
        limit: z.number().int().optional().describe("Max entries to return"),
        skip: z.number().int().optional().describe("Entries to skip"),
        sort: z.string().optional().describe("JSON sort object"),
      }),
    },
    async ({ bucketId, filter, limit, skip, sort }) => {
      const data = await client.get(`/bucket/${bucketId}/data/profile`, {
        filter,
        limit,
        skip,
        sort,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // ── list_user_profile ─────────────────────────────────────────────────
  server.registerTool(
    "list_user_profile",
    {
      title: "List User Profile",
      description:
        "Returns profiled user entries. Useful for debugging user data patterns.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        filter: z.string().optional().describe("JSON filter object"),
        limit: z.number().int().optional().describe("Max entries to return"),
        skip: z.number().int().optional().describe("Entries to skip"),
        sort: z.string().optional().describe("JSON sort object"),
      }),
    },
    async ({ filter, limit, skip, sort }) => {
      const data = await client.get("/passport/user/profile", {
        filter,
        limit,
        skip,
        sort,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // ── list_function_logs ────────────────────────────────────────────────
  server.registerTool(
    "list_function_logs",
    {
      title: "List Function Logs",
      description:
        "Returns function execution logs with optional filters for date range, function IDs, channel, log levels, and content search.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .optional()
          .describe("Max log entries to return"),
        skip: z.number().int().optional().describe("Log entries to skip"),
        begin: z
          .string()
          .optional()
          .describe("Start date (ISO 8601). Defaults to start of today UTC."),
        end: z
          .string()
          .optional()
          .describe("End date (ISO 8601). Defaults to end of today UTC."),
        functions: z
          .array(z.string())
          .optional()
          .describe("Array of function IDs to filter by"),
        channel: z.string().optional().describe("Filter by log channel"),
        levels: z
          .array(z.number().int())
          .optional()
          .describe("Filter by log levels (integer values)"),
        content: z
          .string()
          .optional()
          .describe("Filter by log content (case-insensitive regex match)"),
      }),
    },
    async ({
      limit,
      skip,
      begin,
      end,
      functions,
      channel,
      levels,
      content,
    }) => {
      const data = await client.get("/function-logs", {
        limit,
        skip,
        begin,
        end,
        functions,
        channel,
        levels,
        content,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
