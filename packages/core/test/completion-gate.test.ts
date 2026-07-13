import { describe, expect, it } from "vitest";

import { BudgetTracker, evaluateCompletion, parseAgentResponse } from "../src/index.js";
import type { Clock } from "../src/index.js";

class FakeClock implements Clock {
  constructor(private readonly date: Date) {}
  now(): Date {
    return this.date;
  }
  nowIso(): string {
    return this.date.toISOString();
  }
}

describe("completion gate", () => {
  it("blocks FinishAction before approval, validation, and budget gates are satisfied", () => {
    const finish = { kind: "finish" as const, summary: "done", rationale: "complete" };

    expect(evaluateCompletion({ finish, pendingApproval: true, mutationValidation: "passed", budgetStop: null })).toMatchObject({
      allowed: false,
      reason: "APPROVAL_REQUIRED"
    });
    expect(evaluateCompletion({ finish, pendingApproval: false, mutationValidation: "missing", budgetStop: null })).toMatchObject({
      allowed: false,
      reason: "VALIDATION_REQUIRED"
    });
    expect(evaluateCompletion({ finish, pendingApproval: false, mutationValidation: "failed", budgetStop: null })).toMatchObject({
      allowed: false,
      reason: "VALIDATION_FAILED"
    });

    expect(evaluateCompletion({ finish, pendingApproval: false, mutationValidation: "passed", budgetStop: null })).toMatchObject({
      allowed: true
    });
  });

  it("turns protocol parse failures into bounded retries and then a stop decision", () => {
    const tracker = new BudgetTracker({
      maxRounds: 10,
      maxTokens: 1000,
      maxElapsedMs: 10000,
      repeatedFailureLimit: 3,
      maxProtocolRetries: 2
    }, new FakeClock(new Date("2026-01-01T00:00:00.000Z")));

    expect(parseAgentResponse({ bad: true }, tracker, 1)).toMatchObject({ kind: "retry" });
    expect(parseAgentResponse({ still: "bad" }, tracker, 2)).toMatchObject({ kind: "stop", reason: "PROTOCOL_ERROR" });
    expect(parseAgentResponse({ kind: "finish", summary: "done", rationale: "complete" }, tracker, 3)).toMatchObject({
      kind: "accepted",
      response: { kind: "finish" }
    });
  });
});
