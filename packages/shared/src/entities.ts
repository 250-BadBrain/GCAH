import { z } from "zod";

import { ActionStatus, RunStatus, StepStatus, StopReason } from "./status.js";

const EntityId = z.string().min(1);
const IsoTimestamp = z.string().datetime({ offset: true });
const JsonObject = z.record(z.string(), z.unknown());

export const BudgetStopDetailSchema = z.object({
  limit: z.enum(["rounds", "tokens", "elapsedMs", "repeatedFailures"]),
  used: z.number().nonnegative(),
  max: z.number().nonnegative()
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

export const RunSchema = z.object({
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

export const ActionSchema = z.object({
  id: EntityId,
  stepId: EntityId,
  kind: z.enum(["tool", "finish"]),
  toolName: z.string().min(1).nullable(),
  finishSummary: z.string().nullable(),
  args: JsonObject,
  rationale: z.string(),
  normalizedSummary: z.string(),
  riskCategory: z.string().min(1),
  status: ActionStatus,
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp
}).strict();

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
  stdout: z.string(),
  stderr: z.string(),
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
