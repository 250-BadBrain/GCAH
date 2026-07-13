import type { BudgetStopDetail } from "@gcah/shared";

import type { Clock, LlmUsage } from "../index.js";
import { FailureWindow } from "./failure-window.js";
import { ProtocolRetries } from "./protocol-retries.js";

export interface BudgetLimits {
  maxRounds: number;
  maxTokens: number;
  maxElapsedMs: number;
  repeatedFailureLimit: number;
  maxProtocolRetries: number;
}

export interface BudgetSnapshot {
  rounds: number;
  tokens: number;
  elapsedMs: number;
  repeatedFailures: number;
  usageUnavailable: boolean;
}

export type BudgetStop = {
  reason: "BUDGET_EXHAUSTED";
  detail: BudgetStopDetail;
};

export interface DeterministicStopDetail {
  kind: BudgetStopDetail["kind"] | "protocolRetries";
  limit: number;
  used: number;
  remaining: number;
  observedAtStep: number;
}

export type NonBudgetStop = {
  reason: "REPEATED_FAILURE" | "PROTOCOL_ERROR";
  detail: DeterministicStopDetail;
};

export type UsageUnavailable = {
  reason: "USAGE_UNAVAILABLE";
  event: {
    type: "budget.usage_unavailable";
    summary: string;
    observedAtStep: number;
  };
};

export class BudgetTracker {
  private readonly startedAt: number;
  private rounds = 0;
  private tokens = 0;
  private repeatedFailures = 0;
  private protocolErrors = 0;
  private usageUnavailable = false;
  private readonly failures: FailureWindow;
  private readonly protocolRetries: ProtocolRetries;

  constructor(
    private readonly limits: BudgetLimits,
    private readonly clock: Clock
  ) {
    if (Number.isFinite(limits.maxTokens) && (!Number.isFinite(limits.maxRounds) || !Number.isFinite(limits.maxElapsedMs))) {
      throw new Error("token budgeting requires finite round and elapsed fallback limits");
    }
    this.startedAt = clock.now().getTime();
    this.failures = new FailureWindow(limits.repeatedFailureLimit);
    this.protocolRetries = new ProtocolRetries(limits.maxProtocolRetries);
  }

  recordRound(step: number): BudgetStop | null {
    this.rounds = step;
    if (this.rounds >= this.limits.maxRounds) {
      return this.stop("rounds", this.limits.maxRounds, this.rounds, step);
    }
    return null;
  }

  recordUsage(usage: LlmUsage | null | undefined, step: number): BudgetStop | UsageUnavailable | null {
    if (usage == null) {
      this.usageUnavailable = true;
      return {
        reason: "USAGE_UNAVAILABLE",
        event: {
          type: "budget.usage_unavailable",
          summary: "LLM usage was unavailable; token budget was not incremented.",
          observedAtStep: step
        }
      };
    }
    this.tokens += usage.totalTokens;
    if (this.tokens >= this.limits.maxTokens) {
      return this.stop("tokens", this.limits.maxTokens, this.tokens, step);
    }
    return null;
  }

  checkElapsed(step: number): BudgetStop | null {
    const elapsed = this.elapsedMs();
    if (elapsed >= this.limits.maxElapsedMs) {
      return this.stop("elapsedMs", this.limits.maxElapsedMs, elapsed, step);
    }
    return null;
  }

  recordFailureFingerprint(fingerprint: string, step = 0): NonBudgetStop | null {
    const stopped = this.failures.record(fingerprint);
    this.repeatedFailures = stopped ? this.limits.repeatedFailureLimit : this.repeatedFailures + 1;
    return stopped
      ? {
          reason: "REPEATED_FAILURE",
          detail: {
            kind: "repeatedFailures",
            limit: this.limits.repeatedFailureLimit,
            used: this.limits.repeatedFailureLimit,
            remaining: 0,
            observedAtStep: step
          }
        }
      : null;
  }

  recordProtocolError(step = 0): NonBudgetStop | null {
    this.protocolErrors += 1;
    return this.protocolRetries.record()
      ? {
          reason: "PROTOCOL_ERROR",
          detail: {
            kind: "protocolRetries",
            limit: this.limits.maxProtocolRetries,
            used: this.protocolErrors,
            remaining: Math.max(0, this.limits.maxProtocolRetries - this.protocolErrors),
            observedAtStep: step
          }
        }
      : null;
  }

  snapshot(): BudgetSnapshot {
    return {
      rounds: this.rounds,
      tokens: this.tokens,
      elapsedMs: this.elapsedMs(),
      repeatedFailures: this.repeatedFailures,
      usageUnavailable: this.usageUnavailable
    };
  }

  private elapsedMs(): number {
    return Math.max(0, this.clock.now().getTime() - this.startedAt);
  }

  private stop(kind: BudgetStopDetail["kind"], limit: number, used: number, step: number): BudgetStop {
    return {
      reason: "BUDGET_EXHAUSTED",
      detail: {
        kind,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        observedAtStep: step
      }
    };
  }
}
