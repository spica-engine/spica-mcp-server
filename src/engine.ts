import { z } from "zod";
import type { SpicaClient } from "./client";
import type { SystemKey } from "./schemas/outputs";

export type DataEngine = "mongodb" | "postgresql";

type RecordLike = Record<string, unknown>;

export interface Keys {
  engine: DataEngine;
  systemKey: SystemKey;
  idHint: string;
  idRequired: string;
  documentKeyHint: string;
  idOf(record: unknown): string | undefined;
  bucketDataKey(bucketId: string): Promise<string>;
  invalidateBucket(bucketId: string): void;
  rejectJsonFilter(filter: unknown): void;
}

// Older servers have no /status/engine, and Mongo is the only engine they run.
export async function detectEngine(
  client: Pick<SpicaClient, "get">,
): Promise<DataEngine> {
  try {
    const res = (await client.get("/status/engine")) as RecordLike | null;
    return res?.["engine"] === "postgresql" ? "postgresql" : "mongodb";
  } catch {
    return "mongodb";
  }
}

export function createKeys(
  engine: DataEngine,
  client: Pick<SpicaClient, "get">,
): Keys {
  const systemKey: SystemKey = engine === "postgresql" ? "id" : "_id";
  const primaryCache = new Map<string, string>();

  return {
    engine,
    systemKey,
    idRequired: `\`${systemKey}\` is required.`,
    documentKeyHint:
      engine === "postgresql"
        ? "the bucket's primary property"
        : "`_id`",
    idHint:
      engine === "postgresql"
        ? "UUID (policy ids are names)"
        : "24-character hex ObjectId",
    idOf(record) {
      if (typeof record !== "object" || record === null) return undefined;
      const r = record as RecordLike;
      const value = r[systemKey] ?? r["_id"] ?? r["id"];
      return value === undefined || value === null ? undefined : String(value);
    },
    async bucketDataKey(bucketId) {
      if (engine !== "postgresql") return "_id";
      const cached = primaryCache.get(bucketId);
      if (cached) return cached;
      const bucket = (await client.get(`/bucket/${bucketId}`)) as RecordLike;
      const primary =
        typeof bucket?.["primary"] === "string" ? bucket["primary"] : "id";
      primaryCache.set(bucketId, primary);
      return primary;
    },
    invalidateBucket(bucketId) {
      primaryCache.delete(bucketId);
    },
    rejectJsonFilter(filter) {
      if (engine !== "postgresql" || filter === undefined || filter === "") {
        return;
      }
      if (typeof filter !== "string" || filter.trim().startsWith("{")) {
        throw new Error(
          "JSON filters are not supported on PostgreSQL. Use an expression filter, e.g. document.age > 1.",
        );
      }
    },
  };
}

export const defaultKeys: Keys = createKeys("mongodb", {
  get: async () => ({}),
});

export function idFields(keys: Keys, label: string, required = false) {
  const suffix = required ? " Required." : "";
  return {
    _id: z
      .string()
      .optional()
      .describe(
        `${label} ID (${keys.idHint}). ${keys.systemKey === "_id" ? "" : "Alias of `id`. "}${suffix}`,
      ),
    id: z
      .string()
      .optional()
      .describe(`${label} ID. Alias of \`_id\`.`),
  };
}

export function requireId(...candidates: Array<string | undefined>): string {
  const found = candidates.find((c) => c !== undefined && c !== "");
  if (found === undefined) throw new Error("`_id` or `id` is required.");
  return found;
}
