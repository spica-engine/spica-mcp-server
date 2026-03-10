import { z } from "zod";
import { createHash } from "node:crypto";

// The real API returns options as a JSON Schema object, not an array
export interface EnqueuerOptionProperty {
  type?: string;
  title?: string;
  description?: string;
  enum?: string[];
  items?: { type?: string; enum?: string[] };
  default?: unknown;
}

export interface EnqueuerOptions {
  $id?: string;
  title?: string;
  description?: string;
  type?: string;
  required?: string[];
  properties?: Record<string, EnqueuerOptionProperty>;
  additionalProperties?: boolean;
}

export interface Enqueuer {
  description: {
    icon?: string;
    name: string;
    title: string;
    description: string;
  };
  options?: EnqueuerOptions;
}

export interface FunctionInformation {
  enqueuers: Enqueuer[];
  runtimes: {
    name: string;
    title: string;
    description: string;
    language: string;
  }[];
  timeout: number;
}

export interface TriggerSchemaResult {
  schema: z.ZodType;
  runtimes: FunctionInformation["runtimes"];
  timeout: number;
  fingerprint: string;
}

function propertyToZod(name: string, prop: EnqueuerOptionProperty): z.ZodType {
  const label = prop.description ?? prop.title ?? name;

  if (prop.enum && prop.enum.length > 0) {
    const literals = prop.enum.map((v) => z.literal(v));
    return (
      literals.length === 1
        ? literals[0]
        : z.union(
            literals as [
              z.ZodLiteral<string>,
              z.ZodLiteral<string>,
              ...z.ZodLiteral<string>[],
            ],
          )
    ).describe(label);
  }

  switch (prop.type) {
    case "string":
      return z.string().describe(label);
    case "boolean":
      return z.boolean().describe(label);
    case "number":
    case "integer":
      return z.number().describe(label);
    case "array": {
      let itemSchema: z.ZodType = z.any();
      if (prop.items) {
        if (prop.items.enum && prop.items.enum.length > 0) {
          const itemLiterals = prop.items.enum.map((v) => z.literal(v));
          itemSchema =
            itemLiterals.length === 1
              ? itemLiterals[0]
              : z.union(
                  itemLiterals as [
                    z.ZodLiteral<string>,
                    z.ZodLiteral<string>,
                    ...z.ZodLiteral<string>[],
                  ],
                );
        } else if (prop.items.type === "string") {
          itemSchema = z.string();
        } else if (
          prop.items.type === "number" ||
          prop.items.type === "integer"
        ) {
          itemSchema = z.number();
        }
      }
      return z.array(itemSchema).describe(label);
    }
    default:
      return z.any().describe(label);
  }
}

function buildSingleTriggerSchema(enqueuer: Enqueuer): z.ZodType {
  const required = new Set(enqueuer.options?.required ?? []);
  const properties = enqueuer.options?.properties ?? {};
  const optionsShape: Record<string, z.ZodType> = {};

  for (const [key, prop] of Object.entries(properties)) {
    const zodType = propertyToZod(key, prop);
    optionsShape[key] = required.has(key) ? zodType : zodType.optional();
  }

  return z.object({
    type: z
      .literal(enqueuer.description.name)
      .describe(
        `${enqueuer.description.title}: ${enqueuer.description.description}`,
      ),
    active: z.boolean().optional().describe("Whether the trigger is active"),
    options: z
      .object(optionsShape)
      .describe(`Options for '${enqueuer.description.name}' trigger`),
  });
}

export function buildTriggerSchemas(
  info: FunctionInformation,
): TriggerSchemaResult {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(info.enqueuers))
    .digest("hex");

  if (info.enqueuers.length === 0) {
    const fallback = z.object({
      type: z.string().describe("Trigger type"),
      active: z.boolean().optional().describe("Whether the trigger is active"),
      options: z.record(z.any()).describe("Trigger-specific options"),
    });
    return {
      schema: fallback,
      runtimes: info.runtimes,
      timeout: info.timeout,
      fingerprint,
    };
  }

  const schemas = info.enqueuers.map((e) => buildSingleTriggerSchema(e));

  const triggerDescriptions = info.enqueuers
    .map((e) => {
      const props = e.options?.properties ?? {};
      const propList = Object.entries(props)
        .map(
          ([k, p]) =>
            `${k} (${p.type ?? "any"}${p.enum ? `: ${p.enum.join(" | ")}` : ""})`,
        )
        .join(", ");
      return (
        `- '${e.description.name}': ${e.description.description}` +
        (propList ? `. Options: ${propList}` : "")
      );
    })
    .join("\n");

  const schema =
    schemas.length === 1
      ? schemas[0]
      : z
          .union(schemas as [z.ZodType, z.ZodType, ...z.ZodType[]])
          .describe(
            `Function trigger definition. Available trigger types:\n${triggerDescriptions}`,
          );

  return {
    schema,
    runtimes: info.runtimes,
    timeout: info.timeout,
    fingerprint,
  };
}
