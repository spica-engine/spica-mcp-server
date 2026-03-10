#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SpicaClient } from "./client";
import { registerAuthTools } from "./tools/auth";
import { registerDatabaseTools } from "./tools/database";
import { registerDevelopmentTools } from "./tools/development";
import { registerDebugTools } from "./tools/debug";
import { registerAuditingTools } from "./tools/auditing";
import { registerStorageTools } from "./tools/storage";
import { registerVersionControlTools } from "./tools/versioncontrol";
import {
  buildTriggerSchemas,
  type FunctionInformation,
} from "./schemas/triggers";

const SPICA_URL = process.env["SPICA_URL"];
const SPICA_APIKEY = process.env["SPICA_APIKEY"];

if (!SPICA_URL || !SPICA_APIKEY) {
  process.stderr.write(
    "Error: SPICA_URL and SPICA_APIKEY environment variables are required.\n",
  );
  process.exit(1);
}

const client = new SpicaClient(SPICA_URL, SPICA_APIKEY);

// Fetch trigger information at startup
const functionInfo = (await client.get(
  "/function/information",
)) as FunctionInformation;
const triggerInfo = buildTriggerSchemas(functionInfo);

const server = new McpServer({
  name: "spica-mcp-server",
  version: "1.0.0",
});

registerAuthTools(server, client);
registerDatabaseTools(server, client);
const { saveFunctionTool } = registerDevelopmentTools(
  server,
  client,
  triggerInfo,
);
registerDebugTools(server, client);
registerAuditingTools(server, client);
registerStorageTools(server, client);
registerVersionControlTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);

// Poll trigger information every 60 seconds for runtime changes
let lastFingerprint = triggerInfo.fingerprint;

setInterval(async () => {
  try {
    const info = (await client.get(
      "/function/information",
    )) as FunctionInformation;
    const updated = buildTriggerSchemas(info);

    if (updated.fingerprint !== lastFingerprint) {
      lastFingerprint = updated.fingerprint;

      const runtimeNames = updated.runtimes.map((r) => r.language).join(", ");

      saveFunctionTool.update({
        paramsSchema: {
          _id: z.string().optional().describe("Function ID. Omit to create."),
          name: z.string().describe("Function name"),
          description: z.string().optional().describe("Description"),
          triggers: z
            .record(updated.schema as z.ZodType)
            .describe("Triggers keyed by handler name in function index"),
          timeout: z
            .number()
            .int()
            .describe(
              `Execution timeout in seconds. Default: ${updated.timeout}`,
            ),
          language: z
            .string()
            .describe(
              `Programming language. Available runtimes: ${runtimeNames}`,
            ),
          env_vars: z
            .array(
              z.object({
                _id: z
                  .string()
                  .optional()
                  .describe("Env var ID. Omit to create new."),
                key: z.string().describe("Variable key"),
                value: z.string().describe("Variable value"),
              }),
            )
            .optional()
            .describe(
              "Environment variables to manage. New items (no _id) are created + injected. Existing items (_id) are updated. Removed items are ejected.",
            ),
          secrets: z
            .array(
              z.object({
                _id: z
                  .string()
                  .optional()
                  .describe("Secret ID. Omit to create new."),
                key: z.string().describe("Secret key"),
                value: z.string().describe("Secret value"),
              }),
            )
            .optional()
            .describe(
              "Secrets to manage. New items (no _id) are created + injected. Existing items (_id) are updated. Removed items are ejected.",
            ),
        },
      });

      server.sendToolListChanged();
    }
  } catch {
    // Silently ignore polling errors — will retry next interval
  }
}, 60_000);
