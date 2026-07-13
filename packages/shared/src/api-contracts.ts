import { z } from "zod";

import { RunStatus, StopReason } from "./status.js";

const IsoTimestamp = z.string().datetime({ offset: true });

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
  summary: z.string(),
  cursor: z.number().int().positive(),
  createdAt: IsoTimestamp
}).strict();

export const RunEventsResponseSchema = z.object({
  events: z.array(EventDtoSchema),
  nextCursor: z.number().int().positive().nullable()
}).strict();

export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;
export type ApprovalDecisionRequest = z.infer<typeof ApprovalDecisionRequestSchema>;
export type RunDto = z.infer<typeof RunDtoSchema>;
export type EventDto = z.infer<typeof EventDtoSchema>;
export type RunEventsResponse = z.infer<typeof RunEventsResponseSchema>;
