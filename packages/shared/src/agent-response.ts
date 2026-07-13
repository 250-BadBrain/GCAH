import { z } from "zod";

import {
  DeleteArgsSchema,
  ListArgsSchema,
  MemorySearchArgsSchema,
  PatchArgsSchema,
  ReadArgsSchema,
  RunCommandArgsSchema,
  RunValidationArgsSchema,
  WriteArgsSchema
} from "./tool-contracts.js";

const ToolActionBaseSchema = z.object({
  kind: z.literal("tool"),
  rationale: z.string()
});

export const ToolActionSchema = z.discriminatedUnion("tool", [
  ToolActionBaseSchema.extend({ tool: z.literal("list"), args: ListArgsSchema }).strict(),
  ToolActionBaseSchema.extend({ tool: z.literal("read"), args: ReadArgsSchema }).strict(),
  ToolActionBaseSchema.extend({ tool: z.literal("write"), args: WriteArgsSchema }).strict(),
  ToolActionBaseSchema.extend({ tool: z.literal("patch"), args: PatchArgsSchema }).strict(),
  ToolActionBaseSchema.extend({ tool: z.literal("delete"), args: DeleteArgsSchema }).strict(),
  ToolActionBaseSchema.extend({ tool: z.literal("run_command"), args: RunCommandArgsSchema }).strict(),
  ToolActionBaseSchema.extend({ tool: z.literal("run_validation"), args: RunValidationArgsSchema }).strict(),
  ToolActionBaseSchema.extend({ tool: z.literal("memory_search"), args: MemorySearchArgsSchema }).strict()
]);

export type ToolAction = z.infer<typeof ToolActionSchema>;

export const FinishActionSchema = z.object({
  kind: z.literal("finish"),
  summary: z.string(),
  rationale: z.string()
}).strict();

export type FinishAction = z.infer<typeof FinishActionSchema>;

export const AgentResponseSchema = z.discriminatedUnion("kind", [
  ToolActionSchema,
  FinishActionSchema
]);

export type AgentResponse = z.infer<typeof AgentResponseSchema>;
