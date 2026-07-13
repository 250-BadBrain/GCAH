import { describe, expect, it } from "vitest";

import { transitionAction } from "../src/index.js";
import type { Action } from "@gcah/shared";

const timestamp = "2026-07-13T00:00:00.000Z";

const action: Action = {
  id: "action-1",
  stepId: "step-1",
  kind: "tool",
  toolName: "read",
  finishSummary: null,
  args: { path: "README.md" },
  displayRationale: "read file",
  normalizedSummary: "read README.md",
  riskCategory: "low",
  status: "PROPOSED",
  createdAt: timestamp,
  updatedAt: timestamp
};

describe("action state machine", () => {
  it("applies legal transitions and rejects illegal ones", () => {
    expect(transitionAction(action, { id: "deny", type: "deny", at: timestamp }).status).toBe("DENIED");
    expect(transitionAction(action, { id: "wait", type: "require_approval", at: timestamp }).status).toBe("WAITING_APPROVAL");
    const approved = transitionAction({ ...action, status: "WAITING_APPROVAL" }, { id: "approve", type: "approve", at: timestamp });
    expect(approved.status).toBe("APPROVED");
    expect(transitionAction(approved, { id: "approve", type: "approve", at: timestamp })).toEqual(approved);
    const cloned = structuredClone(approved);
    expect(transitionAction(cloned, { id: "approve", type: "approve", at: timestamp })).toEqual(cloned);
    expect(() => transitionAction({ ...action, status: "DENIED" }, { id: "execute", type: "execute", at: timestamp })).toThrow();
  });
});
