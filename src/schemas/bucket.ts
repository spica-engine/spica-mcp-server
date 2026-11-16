import { z } from "zod";
import type { DataEngine } from "../engine";

const POSTGRES_ONLY_TYPES = ["uuid", "integer", "bigint"] as const;
const POSTGRES_RESERVED_NAMES =
  "_id, _parent, _position, _locale, _value, _source, _target";

export function bucketHints(engine: DataEngine, systemKey: string) {
  const pg = engine === "postgresql";
  return {
    primary: pg
      ? "Required. Names the property that is the bucket's primary key and its documents' data key. That property must be of type uuid, integer, bigint or string; set options.generated to true on it to let the database generate values. Also used as display column."
      : "Primary field key used as display column",
    fieldNames: pg
      ? `Property names must be lowercase letters, digits and underscores, and must not be one of the reserved names: ${POSTGRES_RESERVED_NAMES}.`
      : "Property names must be lowercase with underscores/digits only (pattern: ^(?!(_id)$)([a-z_0-9]*)+$).",
    aclExample: `document.owner==auth.${systemKey}`,
    indexDefinition: pg
      ? "Field paths and index direction (1 for ascending, -1 for descending, or '2dsphere' on a location field)"
      : "Field paths and index direction (1 for ascending, -1 for descending, or 'text' for text index)",
    indexOptions: pg
      ? "Additional index options: unique, sparse, background. Others (e.g. expireAfterSeconds) are not supported"
      : "Additional MongoDB index options (e.g. unique, sparse, expireAfterSeconds for TTL)",
  };
}

export function buildBucketPropertySchema(engine: DataEngine): z.ZodType {
  const pg = engine === "postgresql";
  const hints = bucketHints(engine, "_id");
  const BucketPropertySchema: z.ZodType = z.lazy(() =>
  z.object({
    type: z
      .enum([
        "array",
        "multiselect",
        "boolean",
        "number",
        "object",
        "string",
        "storage",
        "richtext",
        "date",
        "textarea",
        "color",
        "relation",
        "location",
        "json",
        "hash",
        "encrypted",
        ...(pg ? POSTGRES_ONLY_TYPES : []),
      ] as [string, ...string[]])
      .describe(
        "Field type. Standard JSON Schema types: array, boolean, number, object, string. " +
          "Extended Spica types: multiselect, storage, richtext, date, textarea, color, relation, location, json, hash, encrypted" +
          (pg ? ", uuid, integer, bigint (usable as a bucket primary key)." : "."),
      ),
    title: z.string().optional().describe("Display title of the field"),
    description: z.string().optional().describe("Description of the field"),
    default: z.any().optional().describe("Default value for the field"),
    // Number constraints
    maximum: z
      .number()
      .optional()
      .describe("Maximum value (for type 'number')"),
    minimum: z
      .number()
      .optional()
      .describe("Minimum value (for type 'number')"),

    // String constraints
    maxLength: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Maximum string length (for type 'string')"),
    minLength: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Minimum string length (for type 'string')"),
    pattern: z
      .string()
      .optional()
      .describe("Regex validation pattern (for type 'string')"),

    // Array constraints
    items: z
      .union([
        z.lazy(() => BucketPropertySchema),
        z.array(z.lazy(() => BucketPropertySchema)).min(1),
      ])
      .optional()
      .describe(
        "Schema for array items. Single schema or tuple of schemas (for type 'array' or 'multiselect')",
      ),
    maxItems: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Maximum number of array items"),
    minItems: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Minimum number of array items"),
    uniqueItems: z
      .boolean()
      .optional()
      .describe("When true, array items must be unique"),

    // Object constraints
    properties: z
      .record(z.lazy(() => BucketPropertySchema))
      .optional()
      .describe(
        `Nested field definitions (for type 'object'). ${hints.fieldNames}`,
      ),
    required: z
      .array(z.string())
      .optional()
      .describe("Required sub-field names (for type 'object')"),

    // Enum
    enum: z
      .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .min(1)
      .optional()
      .describe("Allowed values. Each value must be unique"),

    // Relation-specific (required when type is 'relation')
    bucketId: z
      .string()
      .optional()
      .describe(
        "Target bucket ID to relate to. Required when type is 'relation'",
      ),
    relationType: z
      .enum(["onetoone", "onetomany"])
      .optional()
      .describe(
        "Relation cardinality. 'onetoone' stores a single reference, 'onetomany' stores an array of references. Required when type is 'relation'",
      ),
    dependent: z
      .boolean()
      .optional()
      .describe(
        "When true, deleting the related document also deletes this document. Only for type 'relation'. Default: false",
      ),

    // Location-specific
    locationType: z
      .enum(["Point"])
      .optional()
      .describe(
        "GeoJSON geometry type. Only for type 'location'. Default: 'Point'",
      ),

    ...(pg
      ? {
          options: z
            .object({
              generated: z
                .boolean()
                .optional()
                .describe(
                  "When true on the primary property, the database generates its value (uuid v7 for uuid, identity for integer/bigint)",
                ),
            })
            .passthrough()
            .optional()
            .describe("Property options"),
        }
      : {}),

    // ACL
    acl: z
      .string()
      .optional()
      .describe(
        "Per-field ACL expression to hide/show values. Example: 'false==true' (users cannot see this field, often used for sensitive data)",
      ),
  }),
);

  return BucketPropertySchema;
}

export const BucketPropertySchema = buildBucketPropertySchema("mongodb");
