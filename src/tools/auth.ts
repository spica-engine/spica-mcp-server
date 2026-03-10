import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpicaClient } from "../client";
import type { ApiKey, Identity, PolicyBase } from "../types";
import {
  ApiKeyOutputSchema,
  ApiKeyListOutputSchema,
  IdentityOutputSchema,
  IdentityListOutputSchema,
  PolicyOutputSchema,
  PolicyListOutputSchema,
  UserListOutputSchema,
} from "../schemas/outputs";

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

const PolicyObjectSchema = z.object({
  _id: z.string().optional().describe("Policy ID. Omit to create new."),
  name: z.string().describe("Policy name"),
  description: z.string().optional(),
  statement: z.array(PolicyStatementSchema),
});

const PolicyInputSchema = z.union([
  z.string().describe("Existing policy ID to attach"),
  PolicyObjectSchema,
]);

export function registerAuthTools(
  server: McpServer,
  client: SpicaClient,
): void {
  // ── list_apikeys ──────────────────────────────────────────────────────
  server.registerTool(
    "list_apikeys",
    {
      title: "List API Keys",
      description:
        "Returns all API keys from the Spica server. No pagination or filtering.",
      annotations: { readOnlyHint: true },
      outputSchema: ApiKeyListOutputSchema,
    },
    async () => {
      const { data } = (await client.get("/passport/apikey")) as {
        data: ApiKey[];
      };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { apikeys: data },
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
          .array(PolicyInputSchema)
          .optional()
          .describe("Policies to attach. Omitted policies will be detached."),
      }),
      outputSchema: ApiKeyOutputSchema,
    },
    async ({ _id, name, description, active, policies }) => {
      const body: { name: string; active: boolean; description?: string } = {
        name,
        active,
      };
      if (description !== undefined) body.description = description;

      let apikey: ApiKey;
      let apikeyId: string;

      if (_id) {
        apikey = (await client.put(`/passport/apikey/${_id}`, body)) as ApiKey;
        apikeyId = _id;
      } else {
        apikey = (await client.post("/passport/apikey", body)) as ApiKey;
        apikeyId = apikey._id;
      }

      if (policies !== undefined) {
        const currentPolicies = apikey.policies ?? [];
        const desiredPolicyIds: string[] = [];

        for (const p of policies) {
          if (typeof p === "string") {
            desiredPolicyIds.push(p);
          } else {
            const policyBody: PolicyBase = {
              name: p.name,
              statement: p.statement,
            };
            if (p.description !== undefined)
              policyBody.description = p.description;

            let saved: PolicyBase & { _id: string };
            if (p._id) {
              saved = (await client.put(
                `/passport/policy/${p._id}`,
                policyBody,
              )) as PolicyBase & { _id: string };
            } else {
              saved = (await client.post(
                "/passport/policy",
                policyBody,
              )) as PolicyBase & { _id: string };
            }
            desiredPolicyIds.push(saved._id);
          }
        }

        for (const pid of desiredPolicyIds) {
          if (!currentPolicies.includes(pid)) {
            await client.put(`/passport/apikey/${apikeyId}/policy/${pid}`);
          }
        }
        for (const pid of currentPolicies) {
          if (!desiredPolicyIds.includes(pid)) {
            await client.delete(`/passport/apikey/${apikeyId}/policy/${pid}`);
          }
        }

        apikey = (await client.get(`/passport/apikey/${apikeyId}`)) as ApiKey;
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(apikey, null, 2) },
        ],
        structuredContent: apikey as unknown as Record<string, unknown>,
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
      outputSchema: IdentityListOutputSchema,
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
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { identities: data },
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
          .array(PolicyInputSchema)
          .optional()
          .describe("Policies to attach. Omitted policies will be detached."),
      }),
      outputSchema: IdentityOutputSchema,
    },
    async ({ _id, identifier, password, policies }) => {
      let identity: Identity;
      let identityId: string;

      if (_id) {
        const body: { identifier?: string; password?: string } = {};
        if (identifier !== undefined) body.identifier = identifier;
        if (password !== undefined) body.password = password;
        identity = (await client.put(
          `/passport/identity/${_id}`,
          body,
        )) as Identity;
        identityId = _id;
      } else {
        identity = (await client.post("/passport/identity", {
          identifier,
          password,
        })) as Identity;
        identityId = identity._id;
      }

      if (policies !== undefined) {
        const currentPolicies = identity.policies ?? [];
        const desiredPolicyIds: string[] = [];

        for (const p of policies) {
          if (typeof p === "string") {
            desiredPolicyIds.push(p);
          } else {
            const policyBody: PolicyBase = {
              name: p.name,
              statement: p.statement,
            };
            if (p.description !== undefined)
              policyBody.description = p.description;

            let saved: PolicyBase & { _id: string };
            if (p._id) {
              saved = (await client.put(
                `/passport/policy/${p._id}`,
                policyBody,
              )) as PolicyBase & { _id: string };
            } else {
              saved = (await client.post(
                "/passport/policy",
                policyBody,
              )) as PolicyBase & { _id: string };
            }
            desiredPolicyIds.push(saved._id);
          }
        }

        for (const pid of desiredPolicyIds) {
          if (!currentPolicies.includes(pid)) {
            await client.put(`/passport/identity/${identityId}/policy/${pid}`);
          }
        }
        for (const pid of currentPolicies) {
          if (!desiredPolicyIds.includes(pid)) {
            await client.delete(
              `/passport/identity/${identityId}/policy/${pid}`,
            );
          }
        }

        identity = (await client.get(
          `/passport/identity/${identityId}`,
        )) as Identity;
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(identity, null, 2) },
        ],
        structuredContent: identity as unknown as Record<string, unknown>,
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
      outputSchema: PolicyListOutputSchema,
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
      const { data } = (await client.get("/passport/policy", {
        filter,
        limit,
        skip,
        sort,
      })) as { data: PolicyBase[] };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { policies: data },
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
      outputSchema: PolicyOutputSchema,
    },
    async ({ _id, name, description, statement }) => {
      const body: PolicyBase = { name, statement };
      if (description !== undefined) body.description = description;

      let policy: PolicyBase;
      if (_id) {
        policy = (await client.put(
          `/passport/policy/${_id}`,
          body,
        )) as PolicyBase;
      } else {
        policy = (await client.post("/passport/policy", body)) as PolicyBase;
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(policy, null, 2) },
        ],
        structuredContent: policy as unknown as Record<string, unknown>,
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
      outputSchema: UserListOutputSchema,
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
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: { users: data },
      };
    },
  );
}
