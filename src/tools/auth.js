import { z } from "zod";

const PolicyStatementSchema = z.object({
  action: z.string().describe("Action identifier"),
  module: z.string().describe("Module name"),
  resource: z
    .union([
      z.string(),
      z.array(z.string()),
      z.object({
        include: z.string().optional(),
        exclude: z.string().optional(),
      }),
    ])
    .optional()
    .describe("Resource scope"),
});

export function registerAuthTools(server, client) {
  // ── list_apikeys ──────────────────────────────────────────────────────
  server.registerTool(
    "list_apikeys",
    {
      title: "List API Keys",
      description:
        "Returns all API keys from the Spica server. No pagination or filtering.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const data = await client.get("/passport/apikey");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // ── save_apikey ───────────────────────────────────────────────────────
  server.registerTool(
    "save_apikey",
    {
      title: "Save API Key",
      description:
        "Creates or updates an API key (upsert). When _id is provided the key is updated, otherwise created. " +
        "Accepts a policies array where each item is either:\n" +
        "- a string (existing policyId to attach)\n" +
        "- a full policy object { _id?, name, description?, statement[] } to create/update and attach.\n" +
        "Policies not present in the array will be detached from the key.",
      inputSchema: z.object({
        _id: z
          .string()
          .optional()
          .describe("API key ID. Omit to create a new key."),
        name: z.string().describe("Name of the API key"),
        description: z.string().optional().describe("Description"),
        active: z.boolean().describe("Whether the key is active"),
        policies: z
          .array(
            z.union([
              z.string().describe("Existing policy ID to attach"),
              z.object({
                _id: z
                  .string()
                  .optional()
                  .describe("Policy ID. Omit to create new."),
                name: z.string().describe("Policy name"),
                description: z.string().optional(),
                statement: z.array(PolicyStatementSchema),
              }),
            ]),
          )
          .optional()
          .describe("Policies to attach. Omitted policies will be detached."),
      }),
    },
    async ({ _id, name, description, active, policies }) => {
      // 1. Upsert the API key itself
      const body = { name, active };
      if (description !== undefined) body.description = description;

      let apikey;
      if (_id) {
        apikey = await client.put(`/passport/apikey/${_id}`, body);
      } else {
        apikey = await client.post("/passport/apikey", body);
        _id = apikey._id;
      }

      // 2. Handle policies
      if (policies !== undefined) {
        const currentPolicies = apikey.policies || [];
        const desiredPolicyIds = [];

        for (const p of policies) {
          if (typeof p === "string") {
            desiredPolicyIds.push(p);
          } else {
            // Create or update the policy
            let saved;
            if (p._id) {
              saved = await client.put(`/passport/policy/${p._id}`, {
                name: p.name,
                description: p.description,
                statement: p.statement,
              });
            } else {
              saved = await client.post("/passport/policy", {
                name: p.name,
                description: p.description,
                statement: p.statement,
              });
            }
            desiredPolicyIds.push(saved._id);
          }
        }

        // Attach new policies
        for (const pid of desiredPolicyIds) {
          if (!currentPolicies.includes(pid)) {
            await client.put(`/passport/apikey/${_id}/policy/${pid}`);
          }
        }
        // Detach removed policies
        for (const pid of currentPolicies) {
          if (!desiredPolicyIds.includes(pid)) {
            await client.delete(`/passport/apikey/${_id}/policy/${pid}`);
          }
        }

        // Re-fetch to get final state
        apikey = await client.get(`/passport/apikey/${_id}`);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(apikey, null, 2) }],
      };
    },
  );

  // ── list_identities ───────────────────────────────────────────────────
  server.registerTool(
    "list_identities",
    {
      title: "List Identities",
      description: "Returns identities with optional filtering and pagination.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        filter: z.string().optional().describe("JSON filter object"),
        limit: z.number().int().optional().describe("Max documents to return"),
        skip: z.number().int().optional().describe("Documents to skip"),
        sort: z
          .string()
          .optional()
          .describe('JSON sort object, e.g. {"identifier":1}'),
      }),
    },
    async ({ filter, limit, skip, sort }) => {
      const data = await client.get("/passport/identity", {
        filter,
        limit,
        skip,
        sort,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // ── save_identity ─────────────────────────────────────────────────────
  server.registerTool(
    "save_identity",
    {
      title: "Save Identity",
      description:
        "Creates or updates an identity (upsert). When _id is provided the identity is updated, otherwise created. " +
        "Accepts a policies array where each item is either:\n" +
        "- a string (existing policyId to attach)\n" +
        "- a full policy object { _id?, name, description?, statement[] } to create/update and attach.\n" +
        "Policies not present in the array will be detached from the identity.",
      inputSchema: z.object({
        _id: z.string().optional().describe("Identity ID. Omit to create."),
        identifier: z.string().describe("Unique identifier for the identity"),
        password: z
          .string()
          .optional()
          .describe("Password. Required on create, optional on update."),
        policies: z
          .array(
            z.union([
              z.string().describe("Existing policy ID to attach"),
              z.object({
                _id: z.string().optional(),
                name: z.string(),
                description: z.string().optional(),
                statement: z.array(PolicyStatementSchema),
              }),
            ]),
          )
          .optional()
          .describe("Policies to attach. Omitted policies will be detached."),
      }),
    },
    async ({ _id, identifier, password, policies }) => {
      let identity;
      if (_id) {
        const body = {};
        if (identifier !== undefined) body.identifier = identifier;
        if (password !== undefined) body.password = password;
        identity = await client.put(`/passport/identity/${_id}`, body);
      } else {
        identity = await client.post("/passport/identity", {
          identifier,
          password,
        });
        _id = identity._id;
      }

      if (policies !== undefined) {
        const currentPolicies = identity.policies || [];
        const desiredPolicyIds = [];

        for (const p of policies) {
          if (typeof p === "string") {
            desiredPolicyIds.push(p);
          } else {
            let saved;
            if (p._id) {
              saved = await client.put(`/passport/policy/${p._id}`, {
                name: p.name,
                description: p.description,
                statement: p.statement,
              });
            } else {
              saved = await client.post("/passport/policy", {
                name: p.name,
                description: p.description,
                statement: p.statement,
              });
            }
            desiredPolicyIds.push(saved._id);
          }
        }

        for (const pid of desiredPolicyIds) {
          if (!currentPolicies.includes(pid)) {
            await client.put(`/passport/identity/${_id}/policy/${pid}`);
          }
        }
        for (const pid of currentPolicies) {
          if (!desiredPolicyIds.includes(pid)) {
            await client.delete(`/passport/identity/${_id}/policy/${pid}`);
          }
        }

        identity = await client.get(`/passport/identity/${_id}`);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(identity, null, 2) }],
      };
    },
  );

  // ── list_policies ─────────────────────────────────────────────────────
  server.registerTool(
    "list_policies",
    {
      title: "List Policies",
      description:
        "Returns access policies with optional filtering and pagination.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        filter: z.string().optional().describe("JSON filter object"),
        limit: z.number().int().optional().describe("Max documents to return"),
        skip: z.number().int().optional().describe("Documents to skip"),
        sort: z
          .string()
          .optional()
          .describe('JSON sort object, e.g. {"name":1}'),
      }),
    },
    async ({ filter, limit, skip, sort }) => {
      const data = await client.get("/passport/policy", {
        filter,
        limit,
        skip,
        sort,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // ── save_policy ───────────────────────────────────────────────────────
  server.registerTool(
    "save_policy",
    {
      title: "Save Policy",
      description:
        "Creates or updates an access policy (upsert). When _id is provided the policy is replaced, otherwise created.",
      inputSchema: z.object({
        _id: z.string().optional().describe("Policy ID. Omit to create."),
        name: z.string().describe("Policy name"),
        description: z.string().optional().describe("Policy description"),
        statement: z
          .array(PolicyStatementSchema)
          .describe("Array of policy statements"),
      }),
    },
    async ({ _id, name, description, statement }) => {
      const body = { name, statement };
      if (description !== undefined) body.description = description;

      let policy;
      if (_id) {
        policy = await client.put(`/passport/policy/${_id}`, body);
      } else {
        policy = await client.post("/passport/policy", body);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(policy, null, 2) }],
      };
    },
  );

  // ── list_users ────────────────────────────────────────────────────────
  server.registerTool(
    "list_users",
    {
      title: "List Users",
      description:
        "Returns users with optional pagination, sorting, and filtering.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        filter: z.string().optional().describe("JSON filter object"),
        limit: z.number().int().optional().describe("Max documents to return"),
        skip: z.number().int().optional().describe("Documents to skip"),
        sort: z
          .string()
          .optional()
          .describe('JSON sort object, e.g. {"username":1}'),
        paginate: z
          .boolean()
          .optional()
          .describe("When true, response includes pagination metadata"),
      }),
    },
    async ({ filter, limit, skip, sort, paginate }) => {
      const data = await client.get("/passport/user", {
        filter,
        limit,
        skip,
        sort,
        paginate,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
