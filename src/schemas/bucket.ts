import { z } from "zod";

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
      ])
      .describe(
        "Field type. Standard JSON Schema types: array, boolean, number, object, string. " +
          "Extended Spica types: multiselect, storage, richtext, date, textarea, color, relation, location, json, hash, encrypted.",
      ),
    title: z.string().optional().describe("Display title of the field"),
    description: z.string().optional().describe("Description of the field"),
    default: z.any().optional().describe("Default value for the field"),
    examples: z
      .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .optional()
      .describe("Example values for this field"),

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
        "Nested field definitions (for type 'object'). Property names must match: ^(?!(_id)$)([a-z_0-9]*)+$",
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

    // ACL
    acl: z
      .string()
      .optional()
      .describe(
        "Per-field ACL expression to hide/show values. Example: 'false==true' (users cannot see this field, often used for sensitive data)",
      ),
  }),
);

export { BucketPropertySchema };
