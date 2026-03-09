#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SpicaClient } from "./client.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerDatabaseTools } from "./tools/database.js";
import { registerDevelopmentTools } from "./tools/development.js";
import { registerDebugTools } from "./tools/debug.js";
import { registerAuditingTools } from "./tools/auditing.js";
import { registerStorageTools } from "./tools/storage.js";
import { registerVersionControlTools } from "./tools/versioncontrol.js";

const SPICA_URL = process.env["SPICA_URL"];
const SPICA_APIKEY = process.env["SPICA_APIKEY"];

if (!SPICA_URL || !SPICA_APIKEY) {
  process.stderr.write(
    "Error: SPICA_URL and SPICA_APIKEY environment variables are required.\n",
  );
  process.exit(1);
}

const client = new SpicaClient(SPICA_URL, SPICA_APIKEY);

const server = new McpServer({
  name: "spica-mcp-server",
  version: "1.0.0",
});

registerAuthTools(server, client);
registerDatabaseTools(server, client);
registerDevelopmentTools(server, client);
registerDebugTools(server, client);
registerAuditingTools(server, client);
registerStorageTools(server, client);
registerVersionControlTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
