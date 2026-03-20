import { z } from "zod";
import { createHash } from "node:crypto";

// Recursive JSON Schema-like interface matching the real API enqueuer options
export interface JsonSchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  items?: JsonSchemaProperty;
  default?: unknown;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
  pattern?: string;
  minItems?: number;
  minLength?: number;
  minimum?: number;
  maximum?: number;
  examples?: unknown[];
  uniqueItems?: boolean;
  allOf?: JsonSchemaProperty[];
  anyOf?: JsonSchemaProperty[];
  oneOf?: JsonSchemaProperty[];
  if?: JsonSchemaProperty;
  then?: JsonSchemaProperty;
  else?: JsonSchemaProperty;
}

export interface EnqueuerOptions {
  $id?: string;
  title?: string;
  description?: string;
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
  additionalProperties?: boolean;
  allOf?: JsonSchemaProperty[];
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

function jsonSchemaToZod(name: string, prop: JsonSchemaProperty): z.ZodType {
  const label = prop.description ?? prop.title ?? name;

  // Handle const values
  if (prop.const !== undefined && prop.const !== null) {
    return z.literal(prop.const as string | number | boolean).describe(label);
  }

  // Handle enum values (filter out nulls for zod literals)
  const validEnumValues = (prop.enum ?? []).filter(
    (v): v is string | number | boolean => v !== null && v !== undefined,
  );
  if (validEnumValues.length > 0) {
    const literals = validEnumValues.map((v) =>
      z.literal(v as string | number | boolean),
    );
    return (
      literals.length === 1
        ? literals[0]
        : z.union(
            literals as [
              z.ZodLiteral<string | number | boolean>,
              z.ZodLiteral<string | number | boolean>,
              ...z.ZodLiteral<string | number | boolean>[],
            ],
          )
    ).describe(label);
  }

  // If enum exists but all values are null/undefined, fall back to the declared type
  const resolvedType = Array.isArray(prop.type) ? prop.type[0] : prop.type;

  switch (resolvedType) {
    case "string":
      return z.string().describe(label);

    case "boolean":
      return z.boolean().describe(label);

    case "number":
    case "integer":
      return z.number().describe(label);

    case "object": {
      if (prop.properties) {
        const requiredSet = new Set(prop.required ?? []);
        const shape: Record<string, z.ZodType> = {};
        for (const [key, subProp] of Object.entries(prop.properties)) {
          const zodType = jsonSchemaToZod(key, subProp);
          shape[key] = requiredSet.has(key) ? zodType : zodType.optional();
        }
        return z.object(shape).describe(label);
      }
      // Object with additionalProperties but no fixed properties
      if (
        prop.additionalProperties &&
        typeof prop.additionalProperties === "object"
      ) {
        const valSchema = jsonSchemaToZod("value", prop.additionalProperties);
        return z.record(valSchema).describe(label);
      }
      return z.record(z.any()).describe(label);
    }

    case "array": {
      let itemSchema: z.ZodType = z.any();
      if (prop.items) {
        itemSchema = jsonSchemaToZod("item", prop.items);
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
    const zodType = jsonSchemaToZod(key, prop);
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
        .map(([k, p]) => {
          const resolvedType = Array.isArray(p.type)
            ? p.type[0]
            : (p.type ?? "any");
          const validEnums = (p.enum ?? []).filter(
            (v) => v !== null && v !== undefined,
          );
          return `${k} (${resolvedType}${validEnums.length ? `: ${validEnums.join(" | ")}` : ""})`;
        })
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
