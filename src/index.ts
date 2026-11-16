#!/usr/bin/env node

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SpicaClient } from "./client";
import { createKeys, detectEngine } from "./engine";
import { registerAuthTools } from "./tools/auth";
import { registerDatabaseTools } from "./tools/database";
import { registerDevelopmentTools } from "./tools/development";
import { registerDebugTools } from "./tools/debug";
import { registerAuditingTools } from "./tools/auditing";
import { registerStorageTools } from "./tools/storage";
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

// Resolved at runtime from the published package root so the version reported
// to MCP clients always matches the npm release, which helps triage bug reports.
const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const client = new SpicaClient(SPICA_URL, SPICA_APIKEY);

// Fetch trigger information at startup
const functionInfo = (await client.get(
  "/function/information",
)) as FunctionInformation;
const triggerInfo = buildTriggerSchemas(functionInfo);

const keys = createKeys(await detectEngine(client), client);

const server = new McpServer({
  name: "spica-mcp-server",
  version,
});

registerAuthTools(server, client, keys);
registerDatabaseTools(server, client, keys);
registerDevelopmentTools(server, client, triggerInfo, keys);
registerDebugTools(server, client, keys);
registerAuditingTools(server, client, keys);
registerStorageTools(server, client, keys);

const transport = new StdioServerTransport();
await server.connect(transport);
