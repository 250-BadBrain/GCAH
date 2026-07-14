import { z } from "zod";

import { RunStatus, StopReason } from "./status.js";

const IsoTimestamp = z.string().datetime({ offset: true });
const SafeDisplayStringSchema = z.string().max(4096).refine((value) => {
  return !/(sk-[A-Za-z0-9_-]+|api[_-]?key\s*=|authorization:\s*bearer\s+|[A-Za-z]:[\\/]+Users[\\/]+|\/home\/)/iu.test(value);
}, {
  message: "display string must be redacted before export"
});

export const CreateRunRequestSchema = z.object({
  workspacePath: z.string().min(1),
  task: z.string().min(1)
}).strict();

export const ApprovalDecisionRequestSchema = z.object({
  decision: z.enum(["approve_once", "approve_session", "reject"]),
  reason: z.string().min(1)
}).strict();

export const RunDtoSchema = z.object({
  id: z.string().min(1),
  status: RunStatus,
  taskSummary: z.string(),
  stopReason: StopReason.nullable(),
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp
}).strict();

export const EventDtoSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  summary: SafeDisplayStringSchema,
  cursor: z.number().int().positive(),
  createdAt: IsoTimestamp
}).strict();

export const RunEventsResponseSchema = z.object({
  events: z.array(EventDtoSchema),
  nextCursor: z.number().int().positive().nullable()
}).strict();

export const ConfigStatusDtoSchema = z.object({
  mode: z.enum(["local", "self-hosted", "public-demo"]),
  llmProvider: z.string().min(1),
  publicDemo: z.boolean()
}).strict();

export const CredentialStatusDtoSchema = z.object({
  backend: z.enum(["available", "unavailable"]),
  providers: z.array(z.object({
    provider: z.string().min(1),
    configured: z.boolean()
  }).strict())
}).strict();

export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;
export type ApprovalDecisionRequest = z.infer<typeof ApprovalDecisionRequestSchema>;
export type RunDto = z.infer<typeof RunDtoSchema>;
export type EventDto = z.infer<typeof EventDtoSchema>;
export type RunEventsResponse = z.infer<typeof RunEventsResponseSchema>;
export type ConfigStatusDto = z.infer<typeof ConfigStatusDtoSchema>;
export type CredentialStatusDto = z.infer<typeof CredentialStatusDtoSchema>;
