import { describe, expect, it } from "vitest";

import { BudgetTracker } from "../src/index.js";
import type { Clock } from "../src/index.js";

class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  nowIso(): string {
    return this.current.toISOString();
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

describe("BudgetTracker", () => {
  it("exhausts rounds, tokens, and wall-clock time with deterministic details", () => {
    const clock = new FakeClock(new Date("2026-07-13T00:00:00.000Z"));
    const tracker = new BudgetTracker({
      maxRounds: 2,
      maxTokens: 10,
      maxElapsedMs: 1000,
      repeatedFailureLimit: 3,
      maxProtocolRetries: 2
    }, clock);

    expect(tracker.recordRound(1)).toBeNull();
    expect(tracker.recordRound(2)).toMatchObject({
      reason: "BUDGET_EXHAUSTED",
      detail: { kind: "rounds", limit: 2, used: 2, remaining: 0, observedAtStep: 2 }
    });

    const tokenTracker = new BudgetTracker({
      maxRounds: 10,
      maxTokens: 10,
      maxElapsedMs: 1000,
      repeatedFailureLimit: 3,
      maxProtocolRetries: 2
    }, clock);
    expect(tokenTracker.recordUsage({ inputTokens: 4, outputTokens: 4, totalTokens: 8 }, 1)).toBeNull();
    expect(tokenTracker.recordUsage({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }, 2)).toMatchObject({
      reason: "BUDGET_EXHAUSTED",
      detail: { kind: "tokens", limit: 10, used: 11, remaining: 0, observedAtStep: 2 }
    });

    const timeTracker = new BudgetTracker({
      maxRounds: 10,
      maxTokens: 100,
      maxElapsedMs: 1000,
      repeatedFailureLimit: 3,
      maxProtocolRetries: 2
    }, clock);
    clock.advance(1001);
    expect(timeTracker.checkElapsed(3)).toMatchObject({
      reason: "BUDGET_EXHAUSTED",
      detail: { kind: "elapsedMs", limit: 1000, used: 1001, remaining: 0, observedAtStep: 3 }
    });
  });

  it("marks missing usage without counting it as zero", () => {
    const clock = new FakeClock(new Date("2026-07-13T00:00:00.000Z"));
    const tracker = new BudgetTracker({
      maxRounds: 10,
      maxTokens: 10,
      maxElapsedMs: 1000,
      repeatedFailureLimit: 3,
      maxProtocolRetries: 2
    }, clock);

    expect(tracker.recordUsage(undefined, 1)).toMatchObject({
      reason: "USAGE_UNAVAILABLE",
      event: { type: "budget.usage_unavailable" }
    });
    expect(tracker.snapshot()).toMatchObject({ tokens: 0, usageUnavailable: true });
  });

  it("stops repeated failures and protocol retries deterministically", () => {
    const clock = new FakeClock(new Date("2026-07-13T00:00:00.000Z"));
    const tracker = new BudgetTracker({
      maxRounds: 10,
      maxTokens: 100,
      maxElapsedMs: 1000,
      repeatedFailureLimit: 2,
      maxProtocolRetries: 2
    }, clock);

    expect(tracker.recordFailureFingerprint("same")).toBeNull();
    expect(tracker.recordFailureFingerprint("same", 2)).toEqual({
      reason: "REPEATED_FAILURE",
      detail: { kind: "repeatedFailures", limit: 2, used: 2, remaining: 0, observedAtStep: 2 }
    });

    const retryTracker = new BudgetTracker({
      maxRounds: 10,
      maxTokens: 100,
      maxElapsedMs: 1000,
      repeatedFailureLimit: 2,
      maxProtocolRetries: 2
    }, clock);
    expect(retryTracker.recordProtocolError()).toBeNull();
    expect(retryTracker.recordProtocolError(2)).toEqual({
      reason: "PROTOCOL_ERROR",
      detail: { kind: "protocolRetries", limit: 2, used: 2, remaining: 0, observedAtStep: 2 }
    });
  });

  it("requires finite fallback limits when token budgets are enabled", () => {
    const clock = new FakeClock(new Date("2026-07-13T00:00:00.000Z"));
    expect(() => new BudgetTracker({
      maxRounds: Number.POSITIVE_INFINITY,
      maxTokens: 10,
      maxElapsedMs: 1000,
      repeatedFailureLimit: 2,
      maxProtocolRetries: 2
    }, clock)).toThrow(/finite round and elapsed/u);
  });
});
