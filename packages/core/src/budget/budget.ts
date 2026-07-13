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

export type NonBudgetStop = {
  reason: "REPEATED_FAILURE" | "PROTOCOL_ERROR";
};

export class BudgetTracker {
  private readonly startedAt: number;
  private rounds = 0;
  private tokens = 0;
  private usageUnavailable = false;
  private readonly failures: FailureWindow;
  private readonly protocolRetries: ProtocolRetries;

  constructor(
    private readonly limits: BudgetLimits,
    private readonly clock: Clock
  ) {
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

  recordUsage(usage: LlmUsage | undefined, step: number): BudgetStop | null {
    if (usage === undefined) {
      this.usageUnavailable = true;
      return null;
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

  recordFailureFingerprint(fingerprint: string): NonBudgetStop | null {
    return this.failures.record(fingerprint) ? { reason: "REPEATED_FAILURE" } : null;
  }

  recordProtocolError(): NonBudgetStop | null {
    return this.protocolRetries.record() ? { reason: "PROTOCOL_ERROR" } : null;
  }

  snapshot(): BudgetSnapshot {
    return {
      rounds: this.rounds,
      tokens: this.tokens,
      elapsedMs: this.elapsedMs(),
      repeatedFailures: 0,
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
