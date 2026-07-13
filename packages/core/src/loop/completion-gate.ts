import { AgentResponseSchema, type AgentResponse, type FinishAction } from "@gcah/shared";

import type { BudgetStop, BudgetTracker, NonBudgetStop } from "../budget/budget.js";

export type MutationValidationState = "none" | "missing" | "failed" | "passed";

export type CompletionDecision =
  | { allowed: true; finish: FinishAction }
  | { allowed: false; reason: "APPROVAL_REQUIRED" | "VALIDATION_REQUIRED" | "VALIDATION_FAILED" | "BUDGET_EXHAUSTED" };

export interface CompletionInput {
  finish: FinishAction;
  pendingApproval: boolean;
  mutationValidation: MutationValidationState;
  budgetStop: BudgetStop | null;
}

export function evaluateCompletion(input: CompletionInput): CompletionDecision {
  if (input.budgetStop !== null) return { allowed: false, reason: "BUDGET_EXHAUSTED" };
  if (input.pendingApproval) return { allowed: false, reason: "APPROVAL_REQUIRED" };
  if (input.mutationValidation === "missing") return { allowed: false, reason: "VALIDATION_REQUIRED" };
  if (input.mutationValidation === "failed") return { allowed: false, reason: "VALIDATION_FAILED" };
  return { allowed: true, finish: input.finish };
}

export type ProtocolParseDecision =
  | { kind: "accepted"; response: AgentResponse }
  | { kind: "retry"; diagnostics: string }
  | { kind: "stop"; reason: NonBudgetStop["reason"]; detail: NonBudgetStop["detail"] };

export function parseAgentResponse(input: unknown, budget: BudgetTracker, step: number): ProtocolParseDecision {
  const parsed = AgentResponseSchema.safeParse(input);
  if (parsed.success) return { kind: "accepted", response: parsed.data };

  const stop = budget.recordProtocolError(step);
  if (stop !== null) return { kind: "stop", reason: stop.reason, detail: stop.detail };
  return { kind: "retry", diagnostics: parsed.error.issues.map((issue) => issue.message).join("; ") };
}
