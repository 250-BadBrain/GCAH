import { describe, expect, it } from "vitest";

import { ApprovalService, normalizedActionHash } from "../src/index.js";
import type { NormalizedAction } from "../src/index.js";

const writeAction: NormalizedAction = {
  kind: "tool",
  tool: "write",
  args: { path: "src/app.ts", content: "new" },
  rationale: "ignored",
  normalizedSummary: "write src/app.ts"
};

describe("ApprovalService", () => {
  it("authorizes only unchanged, unexpired, same-run approvals", () => {
    const service = new ApprovalService();
    const request = service.request({
      requestId: "approval-1",
      runId: "run-1",
      actionId: "action-1",
      action: writeAction,
      riskCategory: "mutation",
      currentRound: 1,
      expiresAtRound: 3
    });

    expect(request.normalizedActionHash).toBe(normalizedActionHash(writeAction));
    expect(service.approve("approval-1", { grantId: "grant-1", currentRound: 1, grantedBy: "human" })).toMatchObject({
      status: "APPROVED"
    });
    expect(service.authorize({ runId: "run-1", action: writeAction, riskCategory: "mutation", currentRound: 2 })).toMatchObject({
      authorized: true
    });
    expect(service.authorize({
      runId: "run-1",
      action: { ...writeAction, args: { path: "src/other.ts", content: "new" } },
      riskCategory: "mutation",
      currentRound: 2
    })).toMatchObject({ authorized: false, reason: "ACTION_CHANGED" });
    expect(service.authorize({ runId: "run-2", action: writeAction, riskCategory: "mutation", currentRound: 2 })).toMatchObject({
      authorized: false,
      reason: "RUN_MISMATCH"
    });
    expect(service.authorize({ runId: "run-1", action: writeAction, riskCategory: "mutation", currentRound: 4 })).toMatchObject({
      authorized: false,
      reason: "EXPIRED"
    });
  });

  it("makes duplicate decisions idempotent and emits rejection feedback once per denied class", () => {
    const service = new ApprovalService();
    service.request({
      requestId: "approval-1",
      runId: "run-1",
      actionId: "action-1",
      action: writeAction,
      riskCategory: "mutation",
      currentRound: 1,
      expiresAtRound: 3
    });

    expect(service.reject("approval-1", { currentRound: 1, humanReason: "no" })).toMatchObject({
      status: "REJECTED",
      feedback: { category: "approval_rejected" }
    });
    expect(service.reject("approval-1", { currentRound: 1, humanReason: "still no" })).toMatchObject({
      status: "REJECTED",
      feedback: null
    });

    service.request({
      requestId: "approval-2",
      runId: "run-1",
      actionId: "action-2",
      action: writeAction,
      riskCategory: "mutation",
      currentRound: 2,
      expiresAtRound: 4
    });
    expect(service.reject("approval-2", { currentRound: 2, humanReason: "same class" })).toMatchObject({
      stopReason: "APPROVAL_REJECTED",
      feedback: null
    });
  });

  it("uses a later valid grant when an earlier grant only partially matches", () => {
    const service = new ApprovalService();
    service.request({
      requestId: "approval-1",
      runId: "run-1",
      actionId: "action-1",
      action: writeAction,
      riskCategory: "mutation",
      currentRound: 1,
      expiresAtRound: 3
    });
    service.approve("approval-1", { grantId: "grant-1", currentRound: 1, grantedBy: "human" });

    const changedAction: NormalizedAction = {
      ...writeAction,
      args: { path: "src/other.ts", content: "new" }
    };
    service.request({
      requestId: "approval-2",
      runId: "run-1",
      actionId: "action-2",
      action: changedAction,
      riskCategory: "mutation",
      currentRound: 2,
      expiresAtRound: 4
    });
    service.approve("approval-2", { grantId: "grant-2", currentRound: 2, grantedBy: "human" });

    expect(service.authorize({ runId: "run-1", action: changedAction, riskCategory: "mutation", currentRound: 3 })).toMatchObject({
      authorized: true,
      grant: { id: "grant-2" }
    });
  });
});
