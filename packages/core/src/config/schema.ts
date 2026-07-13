import { z } from "zod";

export const ConfigSchema = z.object({
  mode: z.string().default("local"),
  budgets: z.object({
    maxRounds: z.number().int().positive().default(10),
    maxTokens: z.number().int().positive().default(100000),
    maxElapsedMs: z.number().int().positive().default(3600000)
  }).strict().default({ maxRounds: 10, maxTokens: 100000, maxElapsedMs: 3600000 }),
  validation: z.object({
    required: z.array(z.string().min(1)).default([])
  }).strict().default({ required: [] }),
  riskThresholds: z.object({
    requireApproval: z.string().min(1).default("medium"),
    deny: z.string().min(1).default("high")
  }).strict().default({ requireApproval: "medium", deny: "high" }),
  commands: z.record(z.string(), z.string().min(1)).default({}),
  allowedWorkspaceRoots: z.array(z.string().min(1)).default([]),
  executorBackend: z.string().default("local"),
  llm: z.object({
    provider: z.string().default("mock")
  }).strict().default({ provider: "mock" })
}).strict();

export type GcahConfig = z.infer<typeof ConfigSchema>;
