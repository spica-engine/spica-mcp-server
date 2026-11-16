import { describe, it, expect, vi } from "vitest";
import { createKeys, detectEngine } from "../../src/engine.js";

describe("detectEngine", () => {
  it("returns postgresql when the server reports it", async () => {
    const client = { get: vi.fn().mockResolvedValue({ engine: "postgresql" }) };
    expect(await detectEngine(client)).toBe("postgresql");
    expect(client.get).toHaveBeenCalledWith("/status/engine");
  });

  it("returns mongodb when the server reports it", async () => {
    const client = { get: vi.fn().mockResolvedValue({ engine: "mongodb" }) };
    expect(await detectEngine(client)).toBe("mongodb");
  });

  it("falls back to mongodb when the endpoint fails", async () => {
    const client = { get: vi.fn().mockRejectedValue(new Error("404")) };
    expect(await detectEngine(client)).toBe("mongodb");
  });

  it("falls back to mongodb on an unexpected shape", async () => {
    const client = { get: vi.fn().mockResolvedValue("ok") };
    expect(await detectEngine(client)).toBe("mongodb");
  });
});

describe("createKeys", () => {
  it("uses _id on mongodb and never fetches the bucket", async () => {
    const client = { get: vi.fn() };
    const keys = createKeys("mongodb", client);
    expect(keys.systemKey).toBe("_id");
    expect(await keys.bucketDataKey("b1")).toBe("_id");
    expect(client.get).not.toHaveBeenCalled();
  });

  it("uses id on postgresql and reads ids from either key", () => {
    const keys = createKeys("postgresql", { get: vi.fn() });
    expect(keys.systemKey).toBe("id");
    expect(keys.idOf({ id: "u1" })).toBe("u1");
    expect(keys.idOf({ _id: "m1" })).toBe("m1");
    expect(keys.idOf({})).toBeUndefined();
  });

  it("resolves the bucket primary once and caches it", async () => {
    const client = { get: vi.fn().mockResolvedValue({ primary: "sku" }) };
    const keys = createKeys("postgresql", client);
    expect(await keys.bucketDataKey("b1")).toBe("sku");
    expect(await keys.bucketDataKey("b1")).toBe("sku");
    expect(client.get).toHaveBeenCalledTimes(1);
    keys.invalidateBucket("b1");
    await keys.bucketDataKey("b1");
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  it("rejects JSON filters only on postgresql", () => {
    const pg = createKeys("postgresql", { get: vi.fn() });
    const mongo = createKeys("mongodb", { get: vi.fn() });
    expect(() => pg.rejectJsonFilter('{"age":{"$gt":1}}')).toThrow(
      /expression/,
    );
    expect(() => pg.rejectJsonFilter("document.age > 1")).not.toThrow();
    expect(() => pg.rejectJsonFilter(undefined)).not.toThrow();
    expect(() => mongo.rejectJsonFilter('{"age":1}')).not.toThrow();
  });
});
