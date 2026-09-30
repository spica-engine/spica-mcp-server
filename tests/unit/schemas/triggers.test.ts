import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  buildTriggerSchemas,
  type FunctionInformation,
} from "../../../src/schemas/triggers.js";

const emptyInfo: FunctionInformation = {
  enqueuers: [],
  runtimes: [
    {
      name: "node",
      title: "Node.js",
      description: "Node runtime",
      language: "javascript",
    },
  ],
  timeout: 10,
};

const httpInfo: FunctionInformation = {
  enqueuers: [
    {
      description: {
        name: "http",
        title: "HTTP",
        description: "HTTP trigger",
      },
      options: {
        type: "object",
        required: ["method"],
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE"],
            title: "HTTP Method",
          },
          path: { type: "string", title: "Path" },
        },
      },
    },
  ],
  runtimes: [
    {
      name: "node",
      title: "Node.js",
      description: "Node runtime",
      language: "javascript",
    },
  ],
  timeout: 120,
};

const multiEnqueuerInfo: FunctionInformation = {
  enqueuers: [
    ...httpInfo.enqueuers,
    {
      description: {
        name: "scheduler",
        title: "Scheduler",
        description: "Cron trigger",
      },
      options: {
        type: "object",
        required: ["timezone"],
        properties: {
          timezone: { type: "string", title: "Timezone" },
          frequency: { type: "string", title: "Frequency" },
        },
      },
    },
  ],
  runtimes: httpInfo.runtimes,
  timeout: 60,
};

// Mirrors the shape of Spica's RabbitMQ enqueuer schema, which shares
// definitions via "$ref" and overrides title/description at each use site.
const rabbitmqInfo: FunctionInformation = {
  enqueuers: [
    {
      description: {
        name: "rabbitmq",
        title: "RabbitMQ",
        description: "RabbitMQ trigger",
      },
      options: {
        type: "object",
        required: ["url"],
        definitions: {
          arguments: { type: "object", additionalProperties: true },
          pattern: {
            description: "Routing key or list of routing keys",
            type: ["string", "array"],
            items: { type: "string" },
          },
          node: {
            type: "object",
            properties: { child: { $ref: "#/definitions/node" } },
          },
        },
        properties: {
          url: { type: "string" },
          queue: {
            type: "object",
            properties: {
              name: { type: "string" },
              arguments: {
                description: "Queue declaration arguments",
                $ref: "#/definitions/arguments",
              },
            },
          },
          bindings: {
            type: "array",
            items: {
              type: "object",
              required: ["exchange", "pattern"],
              properties: {
                exchange: { type: "string" },
                pattern: { $ref: "#/definitions/pattern" },
              },
            },
          },
          tree: { $ref: "#/definitions/node" },
          missing: { $ref: "#/definitions/does-not-exist" },
        },
      },
    },
  ],
  runtimes: httpInfo.runtimes,
  timeout: 60,
};

describe("buildTriggerSchemas", () => {
  describe("return shape", () => {
    it("returns schema, runtimes, timeout, and fingerprint", () => {
      const result = buildTriggerSchemas(emptyInfo);
      expect(result.schema).toBeDefined();
      expect(result.runtimes).toHaveLength(1);
      expect(result.timeout).toBe(10);
      expect(result.fingerprint).toBeDefined();
    });

    it("exposes runtimes from the input info", () => {
      const result = buildTriggerSchemas(httpInfo);
      expect(result.runtimes[0].name).toBe("node");
    });
  });

  describe("empty enqueuers — fallback schema", () => {
    it("produces a valid Zod schema for empty enqueuers", () => {
      const { schema } = buildTriggerSchemas(emptyInfo);
      const parsed = (schema as z.ZodObject<z.ZodRawShape>).safeParse({
        type: "http",
        options: { method: "GET" },
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("HTTP trigger schema", () => {
    it("builds a schema that accepts a valid http trigger object", () => {
      const { schema } = buildTriggerSchemas(httpInfo);
      const parsed = (schema as z.ZodObject<z.ZodRawShape>).safeParse({
        type: "http",
        options: { method: "GET", path: "/hello" },
      });
      expect(parsed.success).toBe(true);
    });

    it("reflects the correct timeout from the info", () => {
      expect(buildTriggerSchemas(httpInfo).timeout).toBe(120);
    });
  });

  describe("multiple enqueuers", () => {
    it("produces a schema for multiple trigger types", () => {
      const { schema } = buildTriggerSchemas(multiEnqueuerInfo);
      expect(schema).toBeDefined();
    });
  });

  describe("$ref resolution", () => {
    const { schema } = buildTriggerSchemas(rabbitmqInfo);
    const parse = (options: Record<string, unknown>) =>
      schema.safeParse({
        type: "rabbitmq",
        options: { url: "amqp://x", ...options },
      });

    it("accepts both variants of a multi-type definition", () => {
      expect(
        parse({ bindings: [{ exchange: "e", pattern: "#" }] }).success,
      ).toBe(true);
      expect(
        parse({ bindings: [{ exchange: "e", pattern: ["info", "error"] }] })
          .success,
      ).toBe(true);
    });

    it("rejects values that match none of the referenced types", () => {
      expect(
        parse({ bindings: [{ exchange: "e", pattern: 42 }] }).success,
      ).toBe(false);
      expect(parse({ queue: { arguments: "not-an-object" } }).success).toBe(
        false,
      );
    });

    it("keeps required fields of objects that contain refs", () => {
      expect(parse({ bindings: [{ exchange: "e" }] }).success).toBe(false);
    });

    it("lets sibling keywords override the referenced definition", () => {
      const options = (schema as z.ZodObject<z.ZodRawShape>).shape
        .options as z.ZodObject<z.ZodRawShape>;
      const queue = (
        options.shape.queue as z.ZodOptional<z.ZodObject<z.ZodRawShape>>
      ).unwrap();
      expect(queue.shape.arguments.description).toBe(
        "Queue declaration arguments",
      );
    });

    it("stops expanding recursive refs instead of overflowing the stack", () => {
      expect(
        parse({ tree: { child: { child: { anything: true } } } }).success,
      ).toBe(true);
    });

    it("falls back to any for refs that cannot be resolved", () => {
      expect(parse({ missing: 123 }).success).toBe(true);
    });

    it("describes referenced options with their resolved type", () => {
      const { schema: union } = buildTriggerSchemas({
        ...rabbitmqInfo,
        enqueuers: [...rabbitmqInfo.enqueuers, ...httpInfo.enqueuers],
      });
      expect(union.description).toContain("tree (object)");
      expect(union.description).toContain("missing (any)");
    });
  });

  describe("fingerprint", () => {
    it("is deterministic: same input produces the same fingerprint", () => {
      const r1 = buildTriggerSchemas(httpInfo);
      const r2 = buildTriggerSchemas(httpInfo);
      expect(r1.fingerprint).toBe(r2.fingerprint);
    });

    it("differs when enqueuers differ", () => {
      const r1 = buildTriggerSchemas(emptyInfo);
      const r2 = buildTriggerSchemas(httpInfo);
      expect(r1.fingerprint).not.toBe(r2.fingerprint);
    });

    it("is a 64-character SHA256 hex string", () => {
      const { fingerprint } = buildTriggerSchemas(httpInfo);
      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
