import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createKeys, type DataEngine } from "../../../src/engine.js";
import { registerDatabaseTools } from "../../../src/tools/database.js";
import { registerAuthTools } from "../../../src/tools/auth.js";
import { buildBucketPropertySchema } from "../../../src/schemas/bucket.js";

function configs(engine: DataEngine) {
  const out: Record<string, any> = {};
  const server = {
    registerTool: vi.fn((name: string, config: unknown) => {
      out[name] = config;
      return {};
    }),
  } as unknown as McpServer;
  const client = { get: vi.fn() };
  const keys = createKeys(engine, client as never);
  registerDatabaseTools(server, client as never, keys);
  registerAuthTools(server, client as never, keys);
  return out;
}

function descriptions(node: any, seen = new Set<unknown>(), acc: string[] = []) {
  if (!node || typeof node !== "object" || seen.has(node)) return acc;
  seen.add(node);
  const def = node._def;
  if (def?.description) acc.push(def.description);
  if (typeof def?.getter === "function") descriptions(def.getter(), seen, acc);
  if (typeof def?.shape === "function") {
    for (const v of Object.values(def.shape())) descriptions(v, seen, acc);
  }
  for (const k of ["innerType", "type", "valueType", "schema", "left", "right"]) {
    descriptions(def?.[k], seen, acc);
  }
  for (const v of def?.options ?? []) descriptions(v, seen, acc);
  if (def?.items) for (const v of def.items) descriptions(v, seen, acc);
  return acc;
}

const text = (c: { description?: string; inputSchema?: unknown }) =>
  [c.description ?? "", ...descriptions(c.inputSchema)].join("\n");

describe("engine-aware tool text", () => {
  it("MongoDB keeps _id wording and omits PostgreSQL-only types", () => {
    const c = configs("mongodb");
    expect(c["update_policy"].description).toContain("`_id` is required");
    expect(text(c["insert_bucket"])).toContain("auth._id");
    expect(text(c["insert_bucket"])).toContain("expireAfterSeconds");
    expect(text(c["insert_bucket"])).not.toMatch(/uuid|PostgreSQL/);
    expect(buildBucketPropertySchema("mongodb").safeParse({ type: "uuid" }).success).toBe(false);
  });

  it("PostgreSQL describes id, primary key rules and expression filters", () => {
    const c = configs("postgresql");
    expect(c["update_policy"].description).toContain("`id` is required");
    expect(text(c["insert_bucket"])).toContain("auth.id");
    expect(text(c["insert_bucket"])).toContain("_parent");
    expect(text(c["insert_bucket"])).not.toContain("expireAfterSeconds for TTL");
    expect(c["list_bucket_data"].description).not.toMatch(/PostgreSQL/);
    expect(text(c["list_bucket_data"])).toContain("Expression filter");
    expect(text(c["save_bucket_data"])).toContain("primary property");
    const pg = buildBucketPropertySchema("postgresql");
    for (const type of ["uuid", "integer", "bigint"]) {
      expect(pg.safeParse({ type }).success).toBe(true);
    }
    expect(
      pg.safeParse({ type: "uuid", options: { generated: true } }).success,
    ).toBe(true);
  });
});
