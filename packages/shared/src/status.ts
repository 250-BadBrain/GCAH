import { z } from "zod";

export const RunStatus = z.enum([
  "PENDING",
  "RUNNING",
  "WAITING_APPROVAL",
  "COMPLETED",
  "STOPPED",
  "FAILED",
  "INTERRUPTED",
  "CANCELLED"
]);

export type RunStatus = z.infer<typeof RunStatus>;

export const StepStatus = z.enum([
  "PENDING",
  "BUILDING_CONTEXT",
  "WAITING_LLM",
  "PARSING_RESPONSE",
  "PROPOSED_ACTION",
  "WAITING_APPROVAL",
  "EXECUTING_TOOL",
  "VALIDATING",
  "FEEDBACK_RECORDED",
  "COMPLETED",
  "FAILED",
  "SKIPPED"
]);

export type StepStatus = z.infer<typeof StepStatus>;

export const ActionStatus = z.enum([
  "PROPOSED",
  "DENIED",
  "WAITING_APPROVAL",
  "APPROVED",
  "EXECUTED",
  "FAILED",
  "SKIPPED"
]);

export type ActionStatus = z.infer<typeof ActionStatus>;

export const StopReason = z.enum([
  "COMPLETED",
  "BUDGET_EXHAUSTED",
  "USER_CANCELLED",
  "POLICY_DENIED",
  "APPROVAL_REJECTED",
  "UNFIXABLE_FAILURE",
  "REPEATED_FAILURE",
  "PROTOCOL_ERROR",
  "INTERRUPTED"
]);

export type StopReason = z.infer<typeof StopReason>;

export const RunStatusStopReasons = {
  PENDING: [],
  RUNNING: [],
  WAITING_APPROVAL: [],
  COMPLETED: ["COMPLETED"],
  STOPPED: [
    "BUDGET_EXHAUSTED",
    "POLICY_DENIED",
    "APPROVAL_REJECTED",
    "REPEATED_FAILURE",
    "PROTOCOL_ERROR"
  ],
  FAILED: ["UNFIXABLE_FAILURE"],
  INTERRUPTED: ["INTERRUPTED"],
  CANCELLED: ["USER_CANCELLED"]
} as const satisfies Record<RunStatus, readonly StopReason[]>;
