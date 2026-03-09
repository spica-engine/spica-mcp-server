import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpicaClient } from "../client.js";

export function registerVersionControlTools(
  server: McpServer,
  client: SpicaClient,
): void {
  // ── list_versioncontrol_commands ──────────────────────────────────────
  server.registerTool(
    "list_versioncontrol_commands",
    {
      title: "List Version Control Commands",
      description: "Returns the available version control (Git) commands.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const data = await client.get("/versioncontrol/commands");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    },
  );

  // ── execute_versioncontrol_command ────────────────────────────────────
  server.registerTool(
    "execute_versioncontrol_command",
    {
      title: "Execute Version Control Command",
      description:
        "Executes a version control command with the given parameters. " +
        "Use list_versioncontrol_commands first to discover available commands.",
      inputSchema: z.object({
        command: z.string().describe("Name of the command to execute"),
        params: z
          .record(z.any())
          .optional()
          .describe("Command-specific parameters"),
      }),
    },
    async ({ command, params }) => {
      const result = await client.post(
        `/versioncontrol/commands/${encodeURIComponent(command)}`,
        params ?? {},
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
