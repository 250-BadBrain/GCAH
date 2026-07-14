import { describe, expect, it } from "vitest";

import { interruptActiveRunsOnStartup } from "../src/index.js";
import { createInMemoryRepositories } from "@gcah/persistence";
import type { Clock } from "@gcah/core";
import type { Run } from "@gcah/shared";

const timestamp = "2026-07-13T00:00:00.000Z";

class FakeClock implements Clock {
  now(): Date {
    return new Date(timestamp);
  }

  nowIso(): string {
    return timestamp;
  }
}

function run(id: string, status: Run["status"]): Run {
  return {
    id,
    workspaceId: id,
    taskSummary: "task",
    status,
    configSnapshotId: "config-1",
    budgetUsage: { rounds: 0, tokens: 0, elapsedMs: 0, repeatedFailures: 0 },
    transitionIds: [],
    stopReason: null,
    stopDetail: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

describe("server restart handling", () => {
  it("interrupts active runs on startup without resuming them", async () => {
    const unitOfWork = createInMemoryRepositories(new FakeClock());
    await unitOfWork.repositories.runs.create(run("run-pending", "PENDING"));
    await unitOfWork.repositories.runs.create(run("run-waiting", "WAITING_APPROVAL"));

    await interruptActiveRunsOnStartup({ unitOfWork, clock: new FakeClock() });

    await expect(unitOfWork.repositories.runs.getById("run-pending")).resolves.toMatchObject({ status: "INTERRUPTED", stopReason: "INTERRUPTED" });
    await expect(unitOfWork.repositories.runs.getById("run-waiting")).resolves.toMatchObject({ status: "INTERRUPTED", stopReason: "INTERRUPTED" });
  });
});
