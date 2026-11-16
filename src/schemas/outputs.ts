import { z } from "zod";

// ─── Shared ───────────────────────────────────────────────────────────────────

export type SystemKey = "_id" | "id";

export function buildOutputSchemas(systemKey: SystemKey) {
  const systemId = {
    [systemKey]: z
      .string()
      .describe(
        systemKey === "_id"
          ? "Unique 24-character hex object ID"
          : "Unique record identifier (UUID, or a name for policies)",
      ),
  };

  // ─── Bucket ───────────────────────────────────────────────────────────────────

  const BucketOutputSchema = {
    ...systemId,
    title: z.string(),
    icon: z.string().optional(),
    description: z.string().optional(),
    primary: z.string().optional(),
    history: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    category: z.string().optional(),
    order: z.number().optional(),
    required: z.array(z.string()).optional(),
    properties: z.record(z.any()).optional(),
    acl: z
      .object({
        read: z.string(),
        write: z.string(),
      })
      .optional(),
    documentSettings: z
      .object({
        countLimit: z.number().optional(),
        limitExceedBehaviour: z.enum(["prevent", "remove"]).optional(),
      })
      .optional(),
    indexes: z
      .array(
        z.object({
          definition: z.record(z.any()),
          options: z.record(z.any()).optional(),
        }),
      )
      .optional(),
  };

  const BucketListOutputSchema = {
    buckets: z.array(z.object(BucketOutputSchema).passthrough()),
  };

  // ─── Bucket Documents ─────────────────────────────────────────────────────────

  const BucketDocumentOutputSchema = {
    ...systemId,
  };

  const BucketDocumentListOutputSchema = {
    documents: z.array(z.record(z.any())),
  };

  const PaginatedBucketDataOutputSchema = {
    meta: z.object({ total: z.number() }),
    data: z.array(z.record(z.any())),
  };

  const ExportBucketDataOutputSchema = {
    filePath: z.string().describe("Absolute path to the written file"),
    format: z.enum(["json", "csv"]),
    totalDocuments: z
      .number()
      .int()
      .describe("Number of documents written to the file"),
  };

  const ImportResultSchema = z.discriminatedUnion("status", [
    z.object({
      id: z.string(),
      status: z.literal("success"),
      insertedId: z.string(),
    }),
    z.object({
      id: z.string(),
      status: z.literal("failure"),
      error: z.string(),
    }),
  ]);

  const ImportBucketDataOutputSchema = {
    totalProcessed: z.number().int(),
    successCount: z.number().int(),
    failureCount: z.number().int(),
    results: z.array(ImportResultSchema).describe("Per-document insert result"),
  };

  // ─── Env Var ──────────────────────────────────────────────────────────────────

  const EnvVarOutputSchema = {
    ...systemId,
    key: z.string(),
    value: z.string(),
    updated_at: z.string().optional(),
  };

  const EnvVarListOutputSchema = {
    env_vars: z.array(z.object(EnvVarOutputSchema).passthrough()),
  };

  // ─── Secret ───────────────────────────────────────────────────────────────────

  const SecretOutputSchema = {
    ...systemId,
    key: z.string(),
    updated_at: z.string().optional(),
  };

  const SecretListOutputSchema = {
    secrets: z.array(z.object(SecretOutputSchema).passthrough()),
  };

  // ─── Function ─────────────────────────────────────────────────────────────────

  const TriggerOutputSchema = z.object({
    type: z.string(),
    active: z.boolean().optional(),
    options: z.record(z.any()),
  });

  const FunctionOutputSchema = {
    ...systemId,
    name: z.string(),
    description: z.string().optional(),
    triggers: z.record(TriggerOutputSchema).optional(),
    timeout: z.number(),
    language: z.string(),
    env_vars: z
      .array(z.union([z.string(), z.object(EnvVarOutputSchema).passthrough()]))
      .optional(),
    // Spica strips secret values when it resolves the relation, so only key metadata comes back.
    secrets: z
      .array(z.union([z.string(), z.object(SecretOutputSchema).passthrough()]))
      .optional(),
    order: z.number().optional(),
  };

  const FunctionListOutputSchema = {
    functions: z.array(z.object(FunctionOutputSchema).passthrough()),
  };

  const FunctionIndexOutputSchema = {
    index: z.string().describe("Source code of the function"),
  };

  const FunctionDependenciesOutputSchema = {
    dependencies: z
      .array(
        z.object({
          name: z.string(),
          version: z.string(),
        }),
      )
      .describe("List of installed packages with their versions"),
  };

  const FunctionLogOutputSchema = {
    ...systemId,
    function: z.string(),
    event_id: z.string().optional(),
    channel: z.string().optional(),
    content: z.string(),
    level: z.number().optional(),
    created_at: z.string().optional(),
  };

  const FunctionLogListOutputSchema = {
    logs: z.array(z.object(FunctionLogOutputSchema).passthrough()),
  };

  // ─── Auth ─────────────────────────────────────────────────────────────────────

  const PolicyStatementOutputSchema = z.object({
    action: z.string(),
    module: z.string(),
    resource: z
      .object({
        include: z.array(z.string()),
        exclude: z.array(z.string()).optional(),
      })
      .optional(),
  });

  const PolicyOutputSchema = {
    ...systemId,
    name: z.string(),
    description: z.string().optional(),
    statement: z.array(PolicyStatementOutputSchema),
    system: z.boolean().optional(),
  };

  const PolicyListOutputSchema = {
    policies: z.array(z.object(PolicyOutputSchema).passthrough()),
  };

  const ApiKeyOutputSchema = {
    ...systemId,
    name: z.string(),
    description: z.string().nullish(),
    active: z.boolean(),
    key: z.string().optional(),
    policies: z.array(z.string()).optional(),
  };

  const ApiKeyListOutputSchema = {
    apikeys: z.array(z.object(ApiKeyOutputSchema).passthrough()),
  };

  const IdentityOutputSchema = {
    ...systemId,
    identifier: z.string(),
    policies: z.array(z.string()).optional(),
    attributes: z.record(z.any()).optional(),
    failedAttempts: z.array(z.any()).optional(),
    lastLogin: z.string().nullish(),
    deactivateJwtsBefore: z.number().optional(),
    authFactor: z
      .object({
        type: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        config: z.record(z.any()).optional(),
      })
      .optional(),
  };

  const IdentityListOutputSchema = {
    identities: z.array(z.object(IdentityOutputSchema).passthrough()),
  };

  const UserOutputSchema = {
    ...systemId,
    username: z.string().optional(),
    policies: z.array(z.string()).optional(),
    failedAttempts: z.array(z.any()).optional(),
    lastLogin: z.string().nullish(),
    deactivateJwtsBefore: z.number().optional(),
  };

  const UserListOutputSchema = {
    users: z.array(z.object(UserOutputSchema).passthrough()),
  };

  // ─── Storage ──────────────────────────────────────────────────────────────────

  const StorageObjectOutputSchema = {
    ...systemId,
    name: z.string(),
    url: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    content: z
      .object({
        type: z.string().describe("MIME type"),
        size: z
          .union([z.number(), z.string()])
          .optional()
          .describe("Size in bytes"),
      })
      .optional(),
  };

  const StorageObjectListOutputSchema = {
    objects: z.array(z.object(StorageObjectOutputSchema).passthrough()),
  };

  // ─── Activity ─────────────────────────────────────────────────────────────────

  const ActivityOutputSchema = {
    ...systemId,
    identifier: z.string().optional(),
    username: z.string().optional(),
    action: z.number().optional(),
    resource: z.array(z.any()).optional(),
    created_at: z.string().optional(),
  };

  const ActivityListOutputSchema = {
    activities: z.array(z.object(ActivityOutputSchema).passthrough()),
  };

  // ─── Profile / Debug ──────────────────────────────────────────────────────────

  const ProfileListOutputSchema = {
    entries: z.array(
      z
        .object({
          op: z.any().optional(),
          ns: z.any().optional(),
          command: z.any().optional(),
          keysExamined: z.any().optional(),
          docsExamined: z.any().optional(),
          numYield: z.any().optional(),
          locks: z.any().optional(),
          millis: z.any().optional(),
          planSummary: z.any().optional(),
          ts: z.any().optional(),
          client: z.any().optional(),
          appName: z.any().optional(),
          allUsers: z.any().optional(),
          user: z.any().optional(),
        })
        .passthrough(),
    ),
  };

  // ─── Success message ──────────────────────────────────────────────────────────

  const SuccessMessageOutputSchema = {
    message: z.string().describe("Success status message"),
  };

  return {
    BucketOutputSchema,
    BucketListOutputSchema,
    BucketDocumentOutputSchema,
    BucketDocumentListOutputSchema,
    PaginatedBucketDataOutputSchema,
    ExportBucketDataOutputSchema,
    ImportBucketDataOutputSchema,
    EnvVarOutputSchema,
    EnvVarListOutputSchema,
    SecretOutputSchema,
    SecretListOutputSchema,
    FunctionOutputSchema,
    FunctionListOutputSchema,
    FunctionIndexOutputSchema,
    FunctionDependenciesOutputSchema,
    FunctionLogOutputSchema,
    FunctionLogListOutputSchema,
    PolicyOutputSchema,
    PolicyListOutputSchema,
    ApiKeyOutputSchema,
    ApiKeyListOutputSchema,
    IdentityOutputSchema,
    IdentityListOutputSchema,
    UserOutputSchema,
    UserListOutputSchema,
    StorageObjectOutputSchema,
    StorageObjectListOutputSchema,
    ActivityOutputSchema,
    ActivityListOutputSchema,
    ProfileListOutputSchema,
    SuccessMessageOutputSchema,
  };
}

export const {
  BucketOutputSchema,
  BucketListOutputSchema,
  BucketDocumentOutputSchema,
  BucketDocumentListOutputSchema,
  PaginatedBucketDataOutputSchema,
  ExportBucketDataOutputSchema,
  ImportBucketDataOutputSchema,
  EnvVarOutputSchema,
  EnvVarListOutputSchema,
  SecretOutputSchema,
  SecretListOutputSchema,
  FunctionOutputSchema,
  FunctionListOutputSchema,
  FunctionIndexOutputSchema,
  FunctionDependenciesOutputSchema,
  FunctionLogOutputSchema,
  FunctionLogListOutputSchema,
  PolicyOutputSchema,
  PolicyListOutputSchema,
  ApiKeyOutputSchema,
  ApiKeyListOutputSchema,
  IdentityOutputSchema,
  IdentityListOutputSchema,
  UserOutputSchema,
  UserListOutputSchema,
  StorageObjectOutputSchema,
  StorageObjectListOutputSchema,
  ActivityOutputSchema,
  ActivityListOutputSchema,
  ProfileListOutputSchema,
  SuccessMessageOutputSchema,
} = buildOutputSchemas("_id");
