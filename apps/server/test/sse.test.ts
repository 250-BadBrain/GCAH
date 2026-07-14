import { describe, expect, it } from "vitest";

import { createServerApp } from "../src/index.js";
import { createInMemoryRepositories } from "@gcah/persistence";
import type { Clock } from "@gcah/core";

const timestamp = "2026-07-13T00:00:00.000Z";

class FakeClock implements Clock {
  now(): Date {
    return new Date(timestamp);
  }

  nowIso(): string {
    return timestamp;
  }
}

describe("server events", () => {
  it("replays committed events from cursor as JSON and SSE", async () => {
    const unitOfWork = createInMemoryRepositories(new FakeClock());
    await seedRun(unitOfWork, "run-1");
    const app = createServerApp({ unitOfWork, clock: new FakeClock(), auth: { enabled: false }, sseIdleTimeoutMs: 5 });
    await unitOfWork.repositories.events.append({
      id: "event-1",
      runId: "run-1",
      stepId: null,
      type: "run.started",
      relatedEntityId: "run-1",
      summary: "started",
      createdAt: timestamp
    });
    await unitOfWork.repositories.events.append({
      id: "event-2",
      runId: "run-1",
      stepId: null,
      type: "run.completed",
      relatedEntityId: "run-1",
      summary: "done",
      createdAt: timestamp
    });

    const json = await app.inject({ method: "GET", url: "/api/runs/run-1/events?cursor=1" });
    expect(json.json()).toEqual({
      events: [expect.objectContaining({ id: "event-2", cursor: 2 })],
      nextCursor: 2
    });

    const sse = await app.inject({ method: "GET", url: "/api/runs/run-1/events/stream", headers: { "last-event-id": "1" } });
    expect(sse.headers["content-type"]).toContain("text/event-stream");
    expect(sse.payload).toContain("id: 2");
    expect(sse.payload).toContain("event: run.completed");
  });

  it("keeps SSE subscribers open for committed events published after replay", async () => {
    const unitOfWork = createInMemoryRepositories(new FakeClock());
    await seedApprovalAction(unitOfWork);
    const app = createServerApp({ unitOfWork, clock: new FakeClock(), auth: { enabled: false }, sseIdleTimeoutMs: 50 });

    const stream = app.inject({ method: "GET", url: "/api/runs/run-live/events/stream" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await app.inject({
      method: "POST",
      url: "/api/runs/run-live/approvals/action-live",
      payload: { decision: "reject", reason: "not approved" }
    });

    const response = await stream;
    expect(response.payload).toContain("event: approval.decision");
    expect(response.payload).toContain("approval decision: reject");
  });
});

async function seedRun(unitOfWork: ReturnType<typeof createInMemoryRepositories>, runId: string): Promise<void> {
  await unitOfWork.repositories.runs.create({
    id: runId,
    workspaceId: `workspace-${runId}`,
    taskSummary: "task",
    status: "RUNNING",
    configSnapshotId: "config-1",
    budgetUsage: { rounds: 0, tokens: 0, elapsedMs: 0, repeatedFailures: 0 },
    transitionIds: [],
    stopReason: null,
    stopDetail: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function seedApprovalAction(unitOfWork: ReturnType<typeof createInMemoryRepositories>): Promise<void> {
  await seedRun(unitOfWork, "run-live");
  await unitOfWork.repositories.steps.create({
    id: "step-live",
    runId: "run-live",
    sequence: 1,
    contextSummary: "context",
    llmUsage: null,
    usageMissing: false,
    status: "WAITING_APPROVAL",
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await unitOfWork.repositories.actions.create({
    id: "action-live",
    stepId: "step-live",
    kind: "tool",
    toolName: "read",
    finishSummary: null,
    args: { path: "README.md" },
    displayRationale: "read",
    normalizedSummary: "read README.md",
    riskCategory: "low",
    status: "WAITING_APPROVAL",
    transitionIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  });
}
