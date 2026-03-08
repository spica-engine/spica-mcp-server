import { z } from "zod";

const TriggerSchema = z.object({
  type: z
    .string()
    .describe(
      "Trigger type (e.g., http, schedule, database, bucket, firehose, system)",
    ),
  active: z.boolean().optional().describe("Whether the trigger is active"),
  options: z.record(z.any()).describe("Trigger-specific options"),
});

export function registerDevelopmentTools(server, client) {
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
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // ── save_function ─────────────────────────────────────────────────────
  server.registerTool(
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
          .record(TriggerSchema)
          .describe("Triggers keyed by handler name in function index"),
        timeout: z.number().int().describe("Execution timeout in seconds"),
        language: z.string().describe("Programming language, e.g. javascript"),
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
      // 1. Upsert the function
      const fnBody = { name, triggers, timeout, language };
      if (description !== undefined) fnBody.description = description;

      let fn;
      if (_id) {
        fn = await client.put(`/function/${_id}`, fnBody);
      } else {
        fn = await client.post("/function", fnBody);
        _id = fn._id;
      }

      // 2. Handle env_vars
      if (env_vars !== undefined) {
        const currentEnvIds = (fn.env_vars || []).map((e) =>
          typeof e === "string" ? e : e._id,
        );
        const desiredEnvIds = [];

        for (const ev of env_vars) {
          if (ev._id) {
            // Update existing env var
            await client.put(`/env-var/${ev._id}`, {
              key: ev.key,
              value: ev.value,
            });
            desiredEnvIds.push(ev._id);
          } else {
            // Create new env var
            const created = await client.post("/env-var", {
              key: ev.key,
              value: ev.value,
            });
            desiredEnvIds.push(created._id);
          }
        }

        // Inject new env vars
        for (const eid of desiredEnvIds) {
          if (!currentEnvIds.includes(eid)) {
            await client.put(`/function/${_id}/env-var/${eid}`);
          }
        }
        // Eject removed env vars
        for (const eid of currentEnvIds) {
          if (!desiredEnvIds.includes(eid)) {
            await client.delete(`/function/${_id}/env-var/${eid}`);
          }
        }
      }

      // 3. Handle secrets
      if (secrets !== undefined) {
        const currentSecretIds = (fn.secrets || []).map((s) =>
          typeof s === "string" ? s : s._id,
        );
        const desiredSecretIds = [];

        for (const secret of secrets) {
          if (secret._id) {
            // Update existing secret
            await client.put(`/secret/${secret._id}`, {
              key: secret.key,
              value: secret.value,
            });
            desiredSecretIds.push(secret._id);
          } else {
            // Create new secret
            const created = await client.post("/secret", {
              key: secret.key,
              value: secret.value,
            });
            desiredSecretIds.push(created._id);
          }
        }

        // Inject new secrets
        for (const sid of desiredSecretIds) {
          if (!currentSecretIds.includes(sid)) {
            await client.put(`/function/${_id}/secret/${sid}`);
          }
        }
        // Eject removed secrets
        for (const sid of currentSecretIds) {
          if (!desiredSecretIds.includes(sid)) {
            await client.delete(`/function/${_id}/secret/${sid}`);
          }
        }
      }

      // Re-fetch to get the final state
      fn = await client.get(`/function/${_id}`);
      return { content: [{ type: "text", text: JSON.stringify(fn, null, 2) }] };
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
        index: z.string().describe("Source code of the function"),
      }),
    },
    async ({ functionId, index }) => {
      await client.post(`/function/${functionId}/index`, { index });
      return {
        content: [
          {
            type: "text",
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
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
