import { z } from "zod";

export function registerStorageTools(server, client) {
  // ── list_storage_objects ──────────────────────────────────────────────
  server.registerTool(
    "list_storage_objects",
    {
      title: "List Storage Objects",
      description:
        "Returns storage objects with optional filtering, pagination, and sorting.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        filter: z.string().optional().describe("JSON filter object"),
        paginate: z
          .boolean()
          .optional()
          .describe("When true, includes pagination metadata"),
        limit: z.number().int().optional().describe("Max objects to return"),
        skip: z.number().int().optional().describe("Objects to skip"),
        sort: z.string().optional().describe("JSON sort object"),
      }),
    },
    async ({ filter, paginate, limit, skip, sort }) => {
      const data = await client.get("/storage", {
        filter,
        paginate,
        limit,
        skip,
        sort,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // ── save_storage_object ───────────────────────────────────────────────
  server.registerTool(
    "save_storage_object",
    {
      title: "Save Storage Object",
      description:
        "Creates or updates a storage object (upsert). When _id is provided the object is replaced, otherwise created. " +
        "Content data must be base64-encoded.",
      inputSchema: z.object({
        _id: z
          .string()
          .optional()
          .describe("Storage object ID. Omit to create a new object."),
        name: z.string().describe("File name"),
        content: z.object({
          type: z.string().describe("MIME type, e.g. text/plain, image/png"),
          data: z.string().describe("Base64-encoded content data"),
        }),
      }),
    },
    async ({ _id, name, content }) => {
      let result;
      if (_id) {
        result = await client.put(`/storage/${_id}`, { name, content });
      } else {
        // POST expects an array
        const arr = await client.post("/storage", [{ name, content }]);
        result = Array.isArray(arr) ? arr[0] : arr;
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── rename_storage_object ─────────────────────────────────────────────
  server.registerTool(
    "rename_storage_object",
    {
      title: "Rename Storage Object",
      description: "Renames a storage object by updating its metadata.",
      inputSchema: z.object({
        id: z.string().describe("Storage object ID"),
        name: z.string().describe("New file name"),
      }),
    },
    async ({ id, name }) => {
      const result = await client.patch(`/storage/${id}`, { name });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
