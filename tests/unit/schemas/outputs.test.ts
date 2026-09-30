import { describe, it, expect } from "vitest";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  FunctionOutputSchema,
  FunctionListOutputSchema,
} from "../../../src/schemas/outputs.js";

describe("FunctionOutputSchema", () => {
  const base = {
    _id: "000000000000000000000000",
    name: "fn",
    timeout: 30,
    language: "javascript",
  };

  it("parses a function with triggers", () => {
    const result = z.object(FunctionOutputSchema).safeParse({
      ...base,
      triggers: { default: { type: "http", options: { path: "/x" } } },
    });
    expect(result.success).toBe(true);
  });

  it("parses a helper function with no triggers field", () => {
    const result = z.object(FunctionOutputSchema).safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts a list containing a triggerless function", () => {
    const result = z.object(FunctionListOutputSchema).safeParse({
      functions: [base],
    });
    expect(result.success).toBe(true);
  });
});

// zod safeParse strips unknown keys, so it can't catch what breaks in practice:
// the SDK validates structuredContent against the JSON Schema it derives, which
// forbids additional properties. Round-trip through a real server/client pair.
describe("list_functions output validation through the MCP SDK", () => {
  async function callListFunctions(functions: unknown[]) {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    server.registerTool(
      "list_functions",
      { outputSchema: FunctionListOutputSchema },
      async () => ({
        content: [{ type: "text" as const, text: "" }],
        structuredContent: { functions },
      }),
    );
    const client = new Client({ name: "test", version: "0.0.0" });
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    await client.listTools();
    return client.callTool({ name: "list_functions", arguments: {} });
  }

  const base = {
    _id: "000000000000000000000000",
    name: "fn",
    timeout: 30,
    language: "javascript",
  };

  it("accepts resolved env vars carrying updated_at", async () => {
    const result = await callListFunctions([
      {
        ...base,
        env_vars: [
          {
            _id: "000000000000000000000001",
            key: "API_URL",
            value: "https://example.com",
            updated_at: "2026-07-20T00:00:00.000Z",
          },
        ],
      },
    ]);
    expect(result.isError).toBeFalsy();
  });

  it("accepts resolved secrets whose value is hidden by the server", async () => {
    const result = await callListFunctions([
      {
        ...base,
        secrets: [
          {
            _id: "000000000000000000000002",
            key: "TOKEN",
            updated_at: "2026-07-20T00:00:00.000Z",
          },
        ],
      },
    ]);
    expect(result.isError).toBeFalsy();
  });

  it("accepts unresolved env var and secret ids", async () => {
    const result = await callListFunctions([
      {
        ...base,
        env_vars: ["000000000000000000000001"],
        secrets: ["000000000000000000000002"],
      },
    ]);
    expect(result.isError).toBeFalsy();
  });
});
