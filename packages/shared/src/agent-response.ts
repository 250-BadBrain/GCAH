import { z } from "zod";

import { SupportedToolName } from "./tool-contracts.js";

export const ToolActionSchema = z.object({
  kind: z.literal("tool"),
  tool: SupportedToolName,
  args: z.record(z.string(), z.unknown()),
  rationale: z.string()
}).strict();

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
