import { z } from "zod";

export function registerDatabaseTools(server, client) {
  // ── list_buckets ──────────────────────────────────────────────────────
  server.registerTool(
    "list_buckets",
    {
      title: "List Buckets",
      description: "Returns all bucket schemas from the Spica server.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const data = await client.get("/bucket");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // ── save_bucket ───────────────────────────────────────────────────────
  server.registerTool(
    "save_bucket",
    {
      title: "Save Bucket",
      description:
        "Creates or updates a bucket schema (upsert). When _id is provided the bucket is replaced, otherwise created. " +
        "The 'properties' field defines the bucket's data model using JSON Schema types and extended Spica types " +
        "(objectid, storage, richtext, textarea, color, multiselect, relation, date, location, json, hash, encrypted).",
      inputSchema: z.object({
        _id: z.string().optional().describe("Bucket ID. Omit to create."),
        title: z.string().optional().describe("Display title"),
        icon: z.string().optional().describe("Icon identifier"),
        description: z.string().optional().describe("Bucket description"),
        primary: z
          .string()
          .describe("Primary field key used as display column"),
        history: z
          .boolean()
          .optional()
          .describe("Enable document history tracking"),
        readOnly: z.boolean().optional().describe("Make bucket read-only"),
        properties: z
          .record(z.any())
          .optional()
          .describe(
            "Field definitions keyed by field name. Each value is a BucketProperty object with type, title, description, options, enum, items, properties, etc.",
          ),
        order: z.number().int().optional().describe("Display order"),
        required: z
          .array(z.string())
          .optional()
          .describe("Array of required field names"),
        acl: z.object({
          read: z.string().describe("ACL expression for read access"),
          write: z.string().describe("ACL expression for write access"),
        }),
        documentSettings: z
          .object({
            countLimit: z.number().int().optional(),
            limitExceedBehaviour: z.enum(["prevent", "remove"]).optional(),
          })
          .optional()
          .describe("Document count limits and overflow behaviour"),
        indexes: z
          .array(
            z.object({
              definition: z.record(z.any()),
              options: z.record(z.any()).optional(),
            }),
          )
          .optional()
          .describe("Custom database indexes"),
      }),
    },
    async ({ _id, ...body }) => {
      let bucket;
      if (_id) {
        bucket = await client.put(`/bucket/${_id}`, body);
      } else {
        bucket = await client.post("/bucket", body);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(bucket, null, 2) }],
      };
    },
  );

  // ── list_bucket_data ──────────────────────────────────────────────────
  server.registerTool(
    "list_bucket_data",
    {
      title: "List Bucket Data",
      description:
        "Returns documents from a bucket with optional filtering, pagination, sorting, and relation resolution.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        bucketId: z.string().describe("Bucket ID"),
        filter: z
          .string()
          .optional()
          .describe("Filter expression or JSON object to filter documents"),
        paginate: z
          .boolean()
          .optional()
          .describe("When true, includes meta.total in response"),
        limit: z.number().int().optional().describe("Max documents to return"),
        skip: z.number().int().optional().describe("Documents to skip"),
        sort: z
          .string()
          .optional()
          .describe('JSON sort, e.g. {"created_at":-1}'),
        relation: z
          .union([z.boolean(), z.array(z.string())])
          .optional()
          .describe(
            "true to resolve all relations, or array of relation field paths",
          ),
        language: z
          .string()
          .optional()
          .describe(
            "Accept-Language for translated documents, e.g. en_US, tr_TR",
          ),
      }),
    },
    async ({
      bucketId,
      filter,
      paginate,
      limit,
      skip,
      sort,
      relation,
      language,
    }) => {
      const query = { filter, paginate, limit, skip, sort };
      if (relation !== undefined) query.relation = relation;

      const headers = {};
      if (language) headers["accept-language"] = language;

      const data = await client._request("GET", `/bucket/${bucketId}/data`, {
        query,
        headers,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // ── save_bucket_data ──────────────────────────────────────────────────
  server.registerTool(
    "save_bucket_data",
    {
      title: "Save Bucket Data",
      description:
        "Creates or updates a document in a bucket (upsert). When the document contains _id it is replaced, otherwise inserted. " +
        "The document body must conform to the bucket's schema definition.",
      inputSchema: z.object({
        bucketId: z.string().describe("Bucket ID"),
        document: z
          .record(z.any())
          .describe(
            "Document object. Include _id to update an existing document, omit to create.",
          ),
      }),
    },
    async ({ bucketId, document }) => {
      let result;
      if (document._id) {
        const { _id, ...body } = document;
        result = await client.put(`/bucket/${bucketId}/data/${_id}`, body);
      } else {
        result = await client.post(`/bucket/${bucketId}/data`, document);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
