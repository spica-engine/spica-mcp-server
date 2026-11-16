import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createKeys } from "../../../src/engine.js";
import { buildOutputSchemas } from "../../../src/schemas/outputs.js";
import { registerAuthTools } from "../../../src/tools/auth.js";
import { registerDatabaseTools } from "../../../src/tools/database.js";
import { registerDevelopmentTools } from "../../../src/tools/development.js";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

function setup() {
  const handlers: Record<string, Handler> = {};
  const mockServer = {
    registerTool: vi.fn((name: string, _c: unknown, handler: Handler) => {
      handlers[name] = handler;
      return {};
    }),
  } as unknown as McpServer;
  const client = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  const keys = createKeys("postgresql", client as never);
  registerAuthTools(mockServer, client as never, keys);
  registerDatabaseTools(mockServer, client as never, keys);
  registerDevelopmentTools(
    mockServer,
    client as never,
    { triggerSchemas: {} } as never,
    keys,
  );
  return { handlers, client };
}

describe("PostgreSQL-backed instance", () => {
  let handlers: Record<string, Handler>;
  let client: ReturnType<typeof setup>["client"];

  beforeEach(() => {
    ({ handlers, client } = setup());
  });

  it("insert_apikey chains follow-up calls on the returned id", async () => {
    client.post.mockResolvedValue({ id: "0190-uuid", name: "k" });
    client.get.mockResolvedValue({ id: "0190-uuid", name: "k" });
    await handlers["insert_apikey"]({
      name: "k",
      active: true,
      policies: ["ActivityFullAccess"],
    });
    expect(client.put).toHaveBeenCalledWith(
      "/passport/apikey/0190-uuid/policy/ActivityFullAccess",
    );
  });

  it("sends a custom id under the id key", async () => {
    client.post.mockResolvedValue({ id: "x" });
    await handlers["insert_identity"]({
      id: "x",
      identifier: "a",
      password: "p",
    });
    expect(client.post).toHaveBeenCalledWith(
      "/passport/identity",
      expect.objectContaining({ id: "x" }),
    );
  });

  it("accepts _id as an alias on update tools", async () => {
    client.put.mockResolvedValue({ id: "p1" });
    client.get.mockResolvedValue({ id: "p1" });
    await handlers["update_policy"]({ _id: "p1", name: "n", statement: [] });
    expect(client.put).toHaveBeenCalledWith(
      "/passport/policy/p1",
      expect.anything(),
    );
  });

  it("requires an id on update tools", async () => {
    await expect(
      handlers["update_policy"]({ name: "n", statement: [] }),
    ).rejects.toThrow(/required/);
  });

  it("save_bucket_data upserts on the bucket primary property", async () => {
    client.get.mockResolvedValue({ primary: "sku" });
    client.put.mockResolvedValue({ sku: "a1", n: 2 });
    await handlers["save_bucket_data"]({
      bucketId: "b1",
      document: { sku: "a1", n: 2 },
    });
    expect(client.put).toHaveBeenCalledWith("/bucket/b1/data/a1", { n: 2 });
  });

  it("save_bucket_data inserts when the primary is absent", async () => {
    client.get.mockResolvedValue({ primary: "id" });
    client.post.mockResolvedValue({ id: "new" });
    await handlers["save_bucket_data"]({ bucketId: "b1", document: { n: 1 } });
    expect(client.post).toHaveBeenCalledWith("/bucket/b1/data", { n: 1 });
  });

  it("save_bucket_data handles numeric primary keys", async () => {
    client.get.mockResolvedValue({ primary: "num" });
    client.put.mockResolvedValue({});
    await handlers["save_bucket_data"]({
      bucketId: "b1",
      document: { num: 7, n: 1 },
    });
    expect(client.put).toHaveBeenCalledWith("/bucket/b1/data/7", { n: 1 });
  });

  it("list_bucket_data rejects JSON filters before calling the API", async () => {
    await expect(
      handlers["list_bucket_data"]({ bucketId: "b1", filter: '{"a":1}' }),
    ).rejects.toThrow(/expression/);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("list_bucket_data passes expression filters through", async () => {
    client.get.mockResolvedValue([]);
    await handlers["list_bucket_data"]({
      bucketId: "b1",
      filter: "document.age > 1",
    });
    expect(client.get).toHaveBeenCalledWith(
      "/bucket/b1/data",
      expect.objectContaining({ filter: "document.age > 1" }),
      expect.anything(),
    );
  });

  it("import_bucket_data reports ids by primary property", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const file = path.join(os.tmpdir(), `pg-import-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify([{ sku: "a1" }]));
    client.get.mockResolvedValue({ primary: "sku" });
    client.post.mockResolvedValue({ sku: "a1" });
    const res = (await handlers["import_bucket_data"]({
      bucketId: "b1",
      filePath: file,
    })) as { structuredContent: { results: Array<{ insertedId: string }> } };
    fs.unlinkSync(file);
    expect(res.structuredContent.results[0].insertedId).toBe("a1");
  });
});

describe("output schemas on PostgreSQL", () => {
  const pg = buildOutputSchemas("id");

  it("accepts id-keyed records and rejects missing id", () => {
    const schema = z.object(pg.ApiKeyOutputSchema);
    expect(schema.safeParse({ id: "u", name: "k", active: true }).success).toBe(
      true,
    );
    expect(schema.safeParse({ name: "k", active: true }).success).toBe(false);
  });
});
