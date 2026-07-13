import { describe, expect, it } from "vitest";

import { cloneInterruptedRunAsPending, interruptRun, transitionRun } from "../src/index.js";
import type { Run } from "@gcah/shared";

const timestamp = "2026-07-13T00:00:00.000Z";

function run(status: Run["status"] = "RUNNING"): Run {
  return {
    id: "run-1",
    workspaceId: "workspace-1",
    taskSummary: "task",
    status,
    configSnapshotId: "config-1",
    budgetUsage: { rounds: 0, tokens: 0, elapsedMs: 0, repeatedFailures: 0 },
    stopReason: null,
    stopDetail: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

describe("run state machine", () => {
  it("enforces terminal reason mappings and idempotent transition ids", () => {
    const completed = transitionRun(run(), {
      id: "t1",
      type: "complete",
      at: timestamp
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.stopReason).toBe("COMPLETED");
    expect(transitionRun(completed, { id: "t1", type: "complete", at: timestamp })).toEqual(completed);

    expect(() => transitionRun(run(), { id: "bad", type: "stop", reason: "UNFIXABLE_FAILURE" as never, at: timestamp })).toThrow();
    expect(transitionRun(run(), { id: "approval", type: "wait_for_approval", at: timestamp }).stopReason).toBeNull();
  });

  it("interrupts without allowing resume and clones only task/config references", () => {
    const interrupted = interruptRun(run(), "interrupt-1", timestamp);
    expect(interrupted.status).toBe("INTERRUPTED");
    expect(interrupted.stopReason).toBe("INTERRUPTED");
    expect(() => transitionRun(interrupted, { id: "resume", type: "start", at: timestamp })).toThrow();
    expect(cloneInterruptedRunAsPending(interrupted, "run-2", timestamp)).toMatchObject({
      id: "run-2",
      taskSummary: "task",
      configSnapshotId: "config-1",
      status: "PENDING",
      stopReason: null
    });
  });
});
