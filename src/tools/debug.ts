import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpicaClient } from "../client";

export function registerDebugTools(
  server: McpServer,
  client: SpicaClient,
): void {
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
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    },
  );
}
