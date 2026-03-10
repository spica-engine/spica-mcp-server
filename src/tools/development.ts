import { z } from "zod";
import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpicaClient } from "../client";
import type { SpicaFunction, Trigger } from "../types";
import type { TriggerSchemaResult } from "../schemas/triggers";
import { index } from "../examples/function";
import {
  FunctionOutputSchema,
  FunctionListOutputSchema,
  FunctionIndexOutputSchema,
  FunctionDependenciesOutputSchema,
  SuccessMessageOutputSchema,
} from "../schemas/outputs";

export function registerDevelopmentTools(
  server: McpServer,
  client: SpicaClient,
  triggerInfo: TriggerSchemaResult,
): { saveFunctionTool: RegisteredTool } {
  // ── list_functions ────────────────────────────────────────────────────
  server.registerTool(
    "list_functions",
    {
      title: "List Functions",
      description: "Returns all serverless function objects.",
      annotations: { readOnlyHint: true },
      outputSchema: FunctionListOutputSchema,
    },
    async () => {
      const data = await client.get("/function");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { functions: data },
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
      outputSchema: FunctionIndexOutputSchema,
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
        structuredContent: data as Record<string, unknown>,
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
      outputSchema: FunctionDependenciesOutputSchema,
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
        structuredContent: data as Record<string, unknown>,
      };
    },
  );

  // ── save_function ─────────────────────────────────────────────────────
  const saveFunctionTool = server.registerTool(
    "save_function",
    {
      title: "Save Function",
      description:
        "Creates or updates a serverless function (upsert). When _id is provided the function is replaced, otherwise created.\n\n" +
        "Environment variable and secret management:\n" +
        "- env_vars: array of { _id?, key, value } objects. Items without _id are created as new env vars and injected. " +
        "Items with _id are updated. Env vars not present in the array are ejected from the function.\n" +
        "- secrets: array of { _id?, key, value } objects. Items without _id are created as new secrets and injected. " +
        "Items with _id are updated. Secrets not present in the array are ejected from the function.\n",
      inputSchema: z.object({
        _id: z.string().optional().describe("Function ID. Omit to create."),
        name: z.string().describe("Function name"),
        description: z.string().optional().describe("Description"),
        triggers: z
          .record(triggerInfo.schema as z.ZodType)
          .describe("Triggers keyed by handler name in function index"),
        timeout: z
          .number()
          .int()
          .describe(
            `Execution timeout in seconds. Default: ${triggerInfo.timeout}`,
          ),
        language: z
          .enum(["javascript", "typescript"])
          .describe("Programming language"),
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
      }),
      outputSchema: FunctionOutputSchema,
    },
    async ({
      _id,
      name,
      description,
      triggers,
      timeout,
      language,
      env_vars,
      secrets,
    }) => {
      const fnBody: {
        name: string;
        triggers: Record<string, Trigger>;
        timeout: number;
        language: string;
        description?: string;
      } = { name, triggers, timeout, language };
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

      if (env_vars !== undefined) {
        const currentEnvIds = (fn.env_vars ?? []).map((e) =>
          typeof e === "string" ? e : e._id,
        );
        const desiredEnvIds: string[] = [];

        for (const ev of env_vars) {
          if (ev._id) {
            await client.put(`/env-var/${ev._id}`, {
              key: ev.key,
              value: ev.value,
            });
            desiredEnvIds.push(ev._id);
          } else {
            const created = (await client.post("/env-var", {
              key: ev.key,
              value: ev.value,
            })) as { _id: string };
            desiredEnvIds.push(created._id);
          }
        }

        for (const eid of desiredEnvIds) {
          if (!currentEnvIds.includes(eid)) {
            await client.put(`/function/${fnId}/env-var/${eid}`);
          }
        }
        for (const eid of currentEnvIds) {
          if (!desiredEnvIds.includes(eid)) {
            await client.delete(`/function/${fnId}/env-var/${eid}`);
          }
        }
      }

      if (secrets !== undefined) {
        const currentSecretIds = (fn.secrets ?? []).map((s) =>
          typeof s === "string" ? s : s._id,
        );
        const desiredSecretIds: string[] = [];

        for (const secret of secrets) {
          if (secret._id) {
            await client.put(`/secret/${secret._id}`, {
              key: secret.key,
              value: secret.value,
            });
            desiredSecretIds.push(secret._id);
          } else {
            const created = (await client.post("/secret", {
              key: secret.key,
              value: secret.value,
            })) as { _id: string };
            desiredSecretIds.push(created._id);
          }
        }

        for (const sid of desiredSecretIds) {
          if (!currentSecretIds.includes(sid)) {
            await client.put(`/function/${fnId}/secret/${sid}`);
          }
        }
        for (const sid of currentSecretIds) {
          if (!desiredSecretIds.includes(sid)) {
            await client.delete(`/function/${fnId}/secret/${sid}`);
          }
        }
      }

      fn = (await client.get(`/function/${fnId}`)) as SpicaFunction;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(fn, null, 2) }],
        structuredContent: fn as unknown as Record<string, unknown>,
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
      outputSchema: SuccessMessageOutputSchema,
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
        structuredContent: {
          message: "Function index updated and compiled successfully.",
        },
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
      outputSchema: FunctionDependenciesOutputSchema,
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
        structuredContent: result as Record<string, unknown>,
      };
    },
  );

  return { saveFunctionTool };
}
