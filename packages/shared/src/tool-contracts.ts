import { z } from "zod";

export const SupportedToolName = z.enum([
  "list",
  "read",
  "write",
  "patch",
  "delete",
  "run_command",
  "run_validation",
  "memory_search"
]);

export type SupportedToolName = z.infer<typeof SupportedToolName>;

const RelativePath = z.string().min(1);
const Sha256Hex = z.string().regex(/^[a-f0-9]{64}$/u);
const EntityId = z.string().min(1);
const IsoTimestamp = z.string().datetime({ offset: true });
const SensitiveOutputSchema = z.string().max(4096).refine((value) => {
  return !/(sk-[A-Za-z0-9_-]+|api[_-]?key\s*=|authorization:\s*bearer\s+|[A-Za-z]:[\\/]+Users[\\/]+|\/home\/)/iu.test(value);
}, {
  message: "output must be redacted before persistence"
});

export const ListArgsSchema = z.object({
  path: z.string().default(".")
}).strict();

export const ReadArgsSchema = z.object({
  path: RelativePath
}).strict();

export const WriteArgsSchema = z.object({
  path: RelativePath,
  content: z.string()
}).strict();

export const PatchArgsSchema = z.object({
  path: RelativePath,
  baseSha256: Sha256Hex,
  unifiedDiff: z.string().min(1)
}).strict();

export const DeleteArgsSchema = z.object({
  path: RelativePath
}).strict();

export const RunCommandArgsSchema = z.object({
  executable: z.string().min(1),
  args: z.array(z.string()),
  cwd: RelativePath,
  timeoutMs: z.number().int().positive()
}).strict();

export const RunValidationArgsSchema = z.object({
  kind: z.enum(["test", "lint", "typecheck", "build", "verify", "custom"])
}).strict();

export const MemorySearchArgsSchema = z.object({
  query: z.string().min(1),
  tags: z.array(z.string()).default([]),
  limit: z.number().int().positive().max(50).default(10)
}).strict();

export const ToolArgsByName = {
  list: ListArgsSchema,
  read: ReadArgsSchema,
  write: WriteArgsSchema,
  patch: PatchArgsSchema,
  delete: DeleteArgsSchema,
  run_command: RunCommandArgsSchema,
  run_validation: RunValidationArgsSchema,
  memory_search: MemorySearchArgsSchema
} as const satisfies Record<SupportedToolName, z.ZodType>;

const ToolRequestBaseSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  actionId: z.string().min(1)
});

export const ToolRequestSchema = z.discriminatedUnion("tool", [
  ToolRequestBaseSchema.extend({ tool: z.literal("list"), args: ListArgsSchema }).strict(),
  ToolRequestBaseSchema.extend({ tool: z.literal("read"), args: ReadArgsSchema }).strict(),
  ToolRequestBaseSchema.extend({ tool: z.literal("write"), args: WriteArgsSchema }).strict(),
  ToolRequestBaseSchema.extend({ tool: z.literal("patch"), args: PatchArgsSchema }).strict(),
  ToolRequestBaseSchema.extend({ tool: z.literal("delete"), args: DeleteArgsSchema }).strict(),
  ToolRequestBaseSchema.extend({ tool: z.literal("run_command"), args: RunCommandArgsSchema }).strict(),
  ToolRequestBaseSchema.extend({ tool: z.literal("run_validation"), args: RunValidationArgsSchema }).strict(),
  ToolRequestBaseSchema.extend({ tool: z.literal("memory_search"), args: MemorySearchArgsSchema }).strict()
]);

export type ToolRequest = z.infer<typeof ToolRequestSchema>;

export const ToolResultSchema = z.object({
  id: EntityId,
  actionId: EntityId,
  status: z.enum(["OK", "ERROR"]),
  exitCode: z.number().int().nullable(),
  toolErrorCode: z.string().nullable(),
  stdout: SensitiveOutputSchema,
  stderr: SensitiveOutputSchema,
  durationMs: z.number().int().nonnegative(),
  sideEffectSummary: SensitiveOutputSchema,
  createdAt: IsoTimestamp
}).strict();

export type { ToolResult } from "./entities.js";
