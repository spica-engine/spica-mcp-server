import { defaultKeys, type Keys, idFields, requireId } from "../engine";
import { z } from "zod";
import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpicaClient } from "../client";
import type { SpicaFunction, Trigger } from "../types";
import type { TriggerSchemaResult } from "../schemas/triggers";
import { index } from "../examples/function";
import { buildOutputSchemas } from "../schemas/outputs";

export function registerDevelopmentTools(
  server: McpServer,
  client: SpicaClient,
  triggerInfo: TriggerSchemaResult,
  keys: Keys = defaultKeys,
): { updateFunctionTool: RegisteredTool } {
  const out = buildOutputSchemas(keys.systemKey);
  // ── Shared input base schemas ─────────────────────────────────────────
  const EnvVarInputBase = z.object({
    key: z.string().describe("Variable key"),
    value: z.string().describe("Variable value"),
  });

  const SecretInputBase = z.object({
    key: z.string().describe("Secret key"),
    value: z.string().describe("Secret value"),
  });

  const FunctionInputBase = z.object({
    name: z.string().describe("Function name"),
    description: z.string().optional().describe("Description"),
    triggers: z
      .record(triggerInfo.schema as z.ZodType)
      .optional()
      .describe(
        "Triggers keyed by handler name in function index. Omit for helper functions that are only imported by other functions.",
      ),
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
      .array(z.string())
      .optional()
      .describe("Env var IDs to associate with the function."),
    secrets: z
      .array(z.string())
      .optional()
      .describe("Secret IDs to associate with the function."),
  });

  // ── list_functions ────────────────────────────────────────────────────
  server.registerTool(
    "list_functions",
    {
      title: "List Functions",
      description: "Returns all serverless function objects.",
      annotations: { readOnlyHint: true },
      outputSchema: out.FunctionListOutputSchema,
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
      outputSchema: out.FunctionIndexOutputSchema,
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
      outputSchema: out.FunctionDependenciesOutputSchema,
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
        structuredContent: { dependencies: data },
      };
    },
  );

  // ── list_env_vars ─────────────────────────────────────────────────────
  server.registerTool(
    "list_env_vars",
    {
      title: "List Environment Variables",
      description: "Returns all environment variable objects.",
      annotations: { readOnlyHint: true },
      outputSchema: out.EnvVarListOutputSchema,
    },
    async () => {
      const data = await client.get("/env-var");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { env_vars: data },
      };
    },
  );

  // ── insert_env_var ─────────────────────────────────────────────────────
  server.registerTool(
    "insert_env_var",
    {
      title: "Insert Environment Variable",
      description: "Creates a new environment variable.",
      outputSchema: z.object(out.EnvVarOutputSchema).passthrough(),
      inputSchema: z
        .object({
          ...idFields(keys, "Record"),
        })
        .merge(EnvVarInputBase),
    },
    async ({ _id, id, key, value }) => {
      const recordId = _id ?? id;
      const body: Record<string, unknown> = { key, value };
      if (recordId !== undefined) body[keys.systemKey] = recordId;
      const result = (await client.post("/env-var", body)) as {
        _id: string;
        key: string;
        value: string;
      };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── update_env_var ─────────────────────────────────────────────────────
  server.registerTool(
    "update_env_var",
    {
      title: "Update Environment Variable",
      description: `Updates an existing environment variable. ${keys.idRequired}`,
      outputSchema: z.object(out.EnvVarOutputSchema).passthrough(),
      inputSchema: z
        .object(idFields(keys, "Env var", true))
        .merge(EnvVarInputBase),
    },
    async ({ _id, id, key, value }) => {
      const recordId = requireId(_id, id);
      const result = (await client.put(`/env-var/${recordId}`, {
        key,
        value,
      })) as { _id: string; key: string; value: string };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── list_secrets ──────────────────────────────────────────────────────
  server.registerTool(
    "list_secrets",
    {
      title: "List Secrets",
      description: "Returns all secret objects.",
      annotations: { readOnlyHint: true },
      outputSchema: out.SecretListOutputSchema,
    },
    async () => {
      const data = await client.get("/secret");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { secrets: data },
      };
    },
  );

  // ── insert_secret ──────────────────────────────────────────────────────
  server.registerTool(
    "insert_secret",
    {
      title: "Insert Secret",
      description: "Creates a new secret.",
      outputSchema: z.object(out.SecretOutputSchema).passthrough(),
      inputSchema: z
        .object({
          ...idFields(keys, "Record"),
        })
        .merge(SecretInputBase),
    },
    async ({ _id, id, key, value }) => {
      const recordId = _id ?? id;
      const body: Record<string, unknown> = { key, value };
      if (recordId !== undefined) body[keys.systemKey] = recordId;
      const result = (await client.post("/secret", body)) as {
        _id: string;
        key: string;
        value: string;
      };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── update_secret ──────────────────────────────────────────────────────
  server.registerTool(
    "update_secret",
    {
      title: "Update Secret",
      description: `Updates an existing secret. ${keys.idRequired}`,
      outputSchema: z.object(out.SecretOutputSchema).passthrough(),
      inputSchema: z
        .object(idFields(keys, "Secret", true))
        .merge(SecretInputBase),
    },
    async ({ _id, id, key, value }) => {
      const recordId = requireId(_id, id);
      const result = (await client.put(`/secret/${recordId}`, {
        key,
        value,
      })) as { _id: string; key: string; value: string };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // ── insert_function ───────────────────────────────────────────────────
  server.registerTool(
    "insert_function",
    {
      title: "Insert Function",
      description:
        "Creates a new serverless function. Use insert_env_var / insert_secret to create env vars and secrets before associating them.",
      inputSchema: z
        .object({
          ...idFields(keys, "Record"),
        })
        .merge(FunctionInputBase),
    },
    async ({ _id, id, name, description, triggers, timeout, language, env_vars, secrets }) => {
      const recordId = _id ?? id;
      const fnBody: {
        [key: string]: unknown;
        name: string;
        triggers?: Record<string, Trigger>;
        timeout: number;
        language: string;
        description?: string;
      } = { name, timeout, language };
      if (triggers !== undefined) fnBody.triggers = triggers;
      if (description !== undefined) fnBody.description = description;
      if (recordId !== undefined) fnBody[keys.systemKey] = recordId;

      let fn = (await client.post("/function", fnBody)) as SpicaFunction;
      const fnId = keys.idOf(fn);

      if (env_vars !== undefined) {
        for (const eid of env_vars) {
          await client.put(`/function/${fnId}/env-var/${eid}`);
        }
      }

      if (secrets !== undefined) {
        for (const sid of secrets) {
          await client.put(`/function/${fnId}/secret/${sid}`);
        }
      }

      fn = (await client.get(`/function/${fnId}`)) as SpicaFunction;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(fn, null, 2) }],
        structuredContent: fn as unknown as Record<string, unknown>,
      };
    },
  );

  // ── update_function ───────────────────────────────────────────────────
  const updateFunctionTool = server.registerTool(
    "update_function",
    {
      title: "Update Function",
      description:
        `Replaces an existing serverless function. ${keys.idRequired} Use insert_env_var / insert_secret to create or update env vars and secrets before associating them.`,
      inputSchema: z
        .object(idFields(keys, "Function", true))
        .merge(FunctionInputBase),
    },
    async ({
      _id,
      id,
      name,
      description,
      triggers,
      timeout,
      language,
      env_vars,
      secrets,
    }) => {
      const recordId = requireId(_id, id);
      const fnBody: {
        name: string;
        triggers?: Record<string, Trigger>;
        timeout: number;
        language: string;
        description?: string;
      } = { name, timeout, language };
      if (triggers !== undefined) fnBody.triggers = triggers;
      if (description !== undefined) fnBody.description = description;

      let fn = (await client.put(`/function/${recordId}`, fnBody)) as SpicaFunction;
      const fnId = recordId;

      if (env_vars !== undefined) {
        const currentEnvIds = (fn.env_vars ?? []).map((e) =>
          typeof e === "string" ? e : keys.idOf(e) ?? "",
        );

        for (const eid of env_vars) {
          if (!currentEnvIds.includes(eid)) {
            await client.put(`/function/${fnId}/env-var/${eid}`);
          }
        }
        for (const eid of currentEnvIds) {
          if (!env_vars.includes(eid)) {
            await client.delete(`/function/${fnId}/env-var/${eid}`);
          }
        }
      }

      if (secrets !== undefined) {
        const currentSecretIds = (fn.secrets ?? []).map((s) =>
          typeof s === "string" ? s : keys.idOf(s) ?? "",
        );

        for (const sid of secrets) {
          if (!currentSecretIds.includes(sid)) {
            await client.put(`/function/${fnId}/secret/${sid}`);
          }
        }
        for (const sid of currentSecretIds) {
          if (!secrets.includes(sid)) {
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
      outputSchema: out.SuccessMessageOutputSchema,
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
      outputSchema: out.SuccessMessageOutputSchema,
      inputSchema: z.object({
        functionId: z.string().describe("Function ID"),
        packages: z
          .array(z.string())
          .describe("Package names to install, e.g. ['lodash', 'axios@1.6.0']"),
      }),
    },
    async ({ functionId, packages }) => {
      await client.post(`/function/${functionId}/dependencies`, {
        name: packages,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully installed packages: ${packages.join(", ")}`,
          },
        ],
        structuredContent: {
          message: `Successfully installed packages: ${packages.join(", ")}`,
        },
      };
    },
  );

  return { updateFunctionTool };
}
