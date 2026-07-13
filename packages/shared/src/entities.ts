import { z } from "zod";

import { ActionStatus, RunStatus, StepStatus, StopReason } from "./status.js";
import { SupportedToolName } from "./tool-contracts.js";

const EntityId = z.string().min(1);
const IsoTimestamp = z.string().datetime({ offset: true });
const JsonObject = z.record(z.string(), z.unknown());

export const BudgetStopDetailSchema = z.object({
  kind: z.enum(["rounds", "tokens", "elapsedMs", "repeatedFailures"]),
  limit: z.number().nonnegative(),
  used: z.number().nonnegative(),
  remaining: z.number().nonnegative(),
  observedAtStep: z.number().int().nonnegative()
}).strict();

export type BudgetStopDetail = z.infer<typeof BudgetStopDetailSchema>;

export const BudgetUsageSchema = z.object({
  rounds: z.number().int().nonnegative(),
  tokens: z.number().int().nonnegative(),
  elapsedMs: z.number().int().nonnegative(),
  repeatedFailures: z.number().int().nonnegative()
}).strict();

export const WorkspaceSchema = z.object({
  id: EntityId,
  rootPath: z.string().min(1),
  allowedWorkspaceRoot: z.string().min(1),
  executionBackend: z.string().min(1),
  runMode: z.string().min(1),
  createdAt: IsoTimestamp
}).strict();

const RunBaseSchema = z.object({
  id: EntityId,
  workspaceId: EntityId,
  taskSummary: z.string(),
  status: RunStatus,
  configSnapshotId: EntityId,
  budgetUsage: BudgetUsageSchema,
  stopReason: StopReason.nullable(),
  stopDetail: JsonObject.or(BudgetStopDetailSchema).nullable(),
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp
}).strict();

function hasBudgetStopDetail(value: unknown): value is BudgetStopDetail {
  return BudgetStopDetailSchema.safeParse(value).success;
}

export const RunSchema = RunBaseSchema.superRefine((run, context) => {
  const allowedStopReasons: Record<
    z.infer<typeof RunStatus>,
    ReadonlySet<z.infer<typeof StopReason>>
  > = {
    PENDING: new Set(),
    RUNNING: new Set(),
    WAITING_APPROVAL: new Set(),
    COMPLETED: new Set(["COMPLETED"]),
    STOPPED: new Set([
      "BUDGET_EXHAUSTED",
      "POLICY_DENIED",
      "APPROVAL_REJECTED",
      "REPEATED_FAILURE",
      "PROTOCOL_ERROR"
    ]),
    FAILED: new Set(["UNFIXABLE_FAILURE"]),
    INTERRUPTED: new Set(["INTERRUPTED"]),
    CANCELLED: new Set(["USER_CANCELLED"])
  };

  const allowed = allowedStopReasons[run.status];
  if (allowed.size === 0) {
    if (run.stopReason !== null) {
      context.addIssue({
        code: "custom",
        message: `${run.status} must not carry a terminal stopReason`,
        path: ["stopReason"]
      });
    }
    return;
  }

  if (run.stopReason === null || !allowed.has(run.stopReason)) {
    context.addIssue({
      code: "custom",
      message: `${run.status} has invalid stopReason`,
      path: ["stopReason"]
    });
  }

  if (run.stopReason === "BUDGET_EXHAUSTED" && !hasBudgetStopDetail(run.stopDetail)) {
    context.addIssue({
      code: "custom",
      message: "BUDGET_EXHAUSTED requires BudgetStopDetail",
      path: ["stopDetail"]
    });
  }
});

export const LlmUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative()
}).strict();

export const StepSchema = z.object({
  id: EntityId,
  runId: EntityId,
  sequence: z.number().int().positive(),
  contextSummary: z.string(),
  llmUsage: LlmUsageSchema.nullable(),
  usageMissing: z.boolean(),
  status: StepStatus,
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp
}).strict();

const ActionBaseSchema = z.object({
  id: EntityId,
  stepId: EntityId,
  displayRationale: z.string().max(2048),
  normalizedSummary: z.string(),
  riskCategory: z.string().min(1),
  status: ActionStatus,
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp
});

export const ActionSchema = z.discriminatedUnion("kind", [
  ActionBaseSchema.extend({
    kind: z.literal("tool"),
    toolName: SupportedToolName,
    finishSummary: z.null(),
    args: JsonObject
  }).strict(),
  ActionBaseSchema.extend({
    kind: z.literal("finish"),
    toolName: z.null(),
    finishSummary: z.string().min(1),
    args: z.object({}).strict()
  }).strict()
]);

const SensitiveOutputSchema = z.string().max(4096).refine((value) => {
  return !/(sk-[A-Za-z0-9_-]+|api[_-]?key\s*=|authorization:\s*bearer\s+|[A-Za-z]:[\\/]+Users[\\/]+|\/home\/)/iu.test(value);
}, {
  message: "output must be redacted before persistence"
});

export const GovernanceDecisionSchema = z.object({
  id: EntityId,
  actionId: EntityId,
  result: z.enum(["ALLOW", "REQUIRE_APPROVAL", "DENY"]),
  ruleId: z.string().min(1),
  riskCategory: z.string().min(1),
  explanation: z.string(),
  createdAt: IsoTimestamp
}).strict();

export const ApprovalRequestSchema = z.object({
  id: EntityId,
  actionId: EntityId,
  normalizedActionHash: z.string().min(1),
  actionSummary: z.string(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]),
  createdAt: IsoTimestamp,
  expiresAt: IsoTimestamp,
  decidedAt: IsoTimestamp.nullable(),
  humanReason: z.string().nullable()
}).strict();

export const SessionGrantSchema = z.object({
  id: EntityId,
  runId: EntityId,
  toolName: z.string().min(1),
  pathScope: z.string().nullable(),
  commandTemplate: z.string().nullable(),
  riskCategory: z.string().min(1),
  scopeHash: z.string().min(1),
  expiresAtRound: z.number().int().positive(),
  grantedBy: z.string().min(1),
  createdAt: IsoTimestamp
}).strict();

export const ToolResultSchema = z.object({
  id: EntityId,
  actionId: EntityId,
  status: z.enum(["OK", "ERROR"]),
  exitCode: z.number().int().nullable(),
  toolErrorCode: z.string().nullable(),
  stdout: SensitiveOutputSchema,
  stderr: SensitiveOutputSchema,
  durationMs: z.number().int().nonnegative(),
  sideEffectSummary: z.string(),
  createdAt: IsoTimestamp
}).strict();

export const ValidationResultSchema = z.object({
  id: EntityId,
  actionId: EntityId,
  type: z.enum(["test", "lint", "typecheck", "build", "custom"]),
  commandSnapshot: z.string(),
  result: z.enum(["PASS", "FAIL", "ERROR", "SKIPPED"]),
  failureCategory: z.string().nullable(),
  failureFingerprint: z.string().nullable(),
  diagnosticSummary: z.string().nullable(),
  durationMs: z.number().int().nonnegative(),
  createdAt: IsoTimestamp
}).strict();

export const FeedbackSchema = z.object({
  id: EntityId,
  sourceId: EntityId,
  sourceType: z.enum(["decision", "validation"]),
  category: z.string().min(1),
  summary: z.string(),
  injected: z.boolean(),
  createdAt: IsoTimestamp
}).strict();

export const MemoryEntrySchema = z.object({
  id: EntityId,
  workspaceId: EntityId,
  type: z.enum(["project_constraint", "approval_decision", "failure_summary"]),
  tags: z.array(z.string()),
  keywords: z.array(z.string()),
  sourceRunId: EntityId,
  summary: z.string(),
  createdAt: IsoTimestamp
}).strict();

export const RunEventSchema = z.object({
  id: EntityId,
  runId: EntityId,
  stepId: EntityId.nullable(),
  type: z.string().min(1),
  relatedEntityId: EntityId.nullable(),
  summary: z.string(),
  cursor: z.number().int().positive(),
  createdAt: IsoTimestamp
}).strict();

export const ConfigSnapshotSchema = z.object({
  id: EntityId,
  schemaVersion: z.number().int().positive(),
  allowedWorkspaceRoots: z.array(z.string().min(1)),
  nonSensitiveConfig: JsonObject,
  contentHash: z.string().min(1),
  createdAt: IsoTimestamp
}).strict();

export const CredentialStatusSchema = z.object({
  provider: z.string().min(1),
  configured: z.boolean(),
  sourceType: z.string().min(1),
  updatedAt: IsoTimestamp.nullable()
}).strict();

export const entitySchemas = {
  WorkspaceSchema,
  RunSchema,
  StepSchema,
  ActionSchema,
  GovernanceDecisionSchema,
  ApprovalRequestSchema,
  SessionGrantSchema,
  ToolResultSchema,
  ValidationResultSchema,
  FeedbackSchema,
  MemoryEntrySchema,
  RunEventSchema,
  ConfigSnapshotSchema,
  CredentialStatusSchema
} as const;

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Run = z.infer<typeof RunSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type GovernanceDecision = z.infer<typeof GovernanceDecisionSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type SessionGrant = z.infer<typeof SessionGrantSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type Feedback = z.infer<typeof FeedbackSchema>;
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
export type ConfigSnapshot = z.infer<typeof ConfigSnapshotSchema>;
export type CredentialStatus = z.infer<typeof CredentialStatusSchema>;
