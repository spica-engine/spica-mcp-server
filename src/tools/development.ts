import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpicaClient } from "../client";
import type { SpicaFunction, Trigger } from "../types";
import { index } from "../examples/function";

const TriggerSchema = z.object({
  type: z
    .string()
    .describe(
      "Trigger type (e.g., http, schedule, database, bucket, firehose, system)",
    ),
  active: z.boolean().optional().describe("Whether the trigger is active"),
  options: z.record(z.any()).describe("Trigger-specific options"),
});

export function registerDevelopmentTools(
  server: McpServer,
  client: SpicaClient,
): void {
  // ── list_triggers ─────────────────────────────────────────────────────
  server.registerTool(
    "list_triggers",
    {
      title: "List Available Triggers",
      description:
        "Returns available function enqueuers (trigger types), runtimes, and default timeout information.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const data = await client.get("/function/information");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    },
  );

  // ── list_functions ────────────────────────────────────────────────────
  server.registerTool(
    "list_functions",
    {
      title: "List Functions",
      description: "Returns all serverless function objects.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const data = await client.get("/function");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    },
  );

  // ── get_function_index ────────────────────────────────────────────────
  server.registerTool(
    "get_function_index",
    {
      title: "Get Function Index",
      description: "Returns the source code (index) of a specific function.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        functionId: z.string().describe("Function ID"),
      }),
    },
    async ({ functionId }) => {
      const data = await client.get(`/function/${functionId}/index`);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    },
  );

  // ── get_function_dependencies ─────────────────────────────────────────
  server.registerTool(
    "get_function_dependencies",
    {
      title: "Get Function Dependencies",
      description:
        "Returns the installed dependencies and their versions for a specific function.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        functionId: z.string().describe("Function ID"),
      }),
    },
    async ({ functionId }) => {
      const data = await client.get(`/function/${functionId}/dependencies`);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    },
  );

  // ── save_function ─────────────────────────────────────────────────────
  server.registerTool(
    "save_function",
    {
      title: "Save Function",
      description:
        "Creates or updates a serverless function (upsert). When _id is provided the function is replaced, otherwise created.",
      inputSchema: z.object({
        _id: z.string().optional().describe("Function ID. Omit to create."),
        name: z.string().describe("Function name"),
        description: z.string().optional().describe("Description"),
        triggers: z
          .record(TriggerSchema)
          .describe("Triggers keyed by handler name in function index"),
        timeout: z.number().int().describe("Execution timeout in seconds"),
        language: z.string().describe("Programming language, e.g. javascript"),
        env: z.object({}).describe("Environment variables as key-value pairs"),
      }),
    },
    async ({ _id, name, description, triggers, timeout, language, env }) => {
      const fnBody: {
        name: string;
        triggers: Record<string, Trigger>;
        timeout: number;
        language: string;
        description?: string;
        env?: Record<string, string>;
      } = { name, triggers, timeout, language, env };
      if (description !== undefined) fnBody.description = description;

      let fn: SpicaFunction;
      let fnId: string;

      if (_id) {
        fn = (await client.put(`/function/${_id}`, fnBody)) as SpicaFunction;
        fnId = _id;
      } else {
        fn = (await client.post("/function", fnBody)) as SpicaFunction;
        fnId = fn._id;
      }

      fn = (await client.get(`/function/${fnId}`)) as SpicaFunction;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(fn, null, 2) }],
      };
    },
  );

  // ── save_function_index ───────────────────────────────────────────────
  server.registerTool(
    "save_function_index",
    {
      title: "Save Function Index",
      description:
        "Replaces and compiles the source code (index) of a function. " +
        "Returns 204 on success or a compilation diagnostics error on failure.",
      inputSchema: z.object({
        functionId: z.string().describe("Function ID"),
        index: z
          .string()
          .describe(
            `Source code of the function, example: ${JSON.stringify(index, null, 2)}`,
          ),
      }),
    },
    async ({ functionId, index }) => {
      await client.post(`/function/${functionId}/index`, { index });
      return {
        content: [
          {
            type: "text" as const,
            text: "Function index updated and compiled successfully.",
          },
        ],
      };
    },
  );

  // ── save_function_dependencies ────────────────────────────────────────
  server.registerTool(
    "save_function_dependencies",
    {
      title: "Save Function Dependencies",
      description:
        "Installs one or more npm packages as dependencies for a function.",
      inputSchema: z.object({
        functionId: z.string().describe("Function ID"),
        packages: z
          .array(z.string())
          .describe("Package names to install, e.g. ['lodash', 'axios@1.6.0']"),
      }),
    },
    async ({ functionId, packages }) => {
      const result = await client.post(`/function/${functionId}/dependencies`, {
        name: packages,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
