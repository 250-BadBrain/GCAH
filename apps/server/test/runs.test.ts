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

describe("server run routes", () => {
  it("serves health and creates/statuses/cancels/clones runs through injected repositories", async () => {
    const unitOfWork = createInMemoryRepositories(new FakeClock());
    const app = createServerApp({ unitOfWork, clock: new FakeClock(), auth: { enabled: false } });

    await expect(app.inject({ method: "GET", url: "/health" })).resolves.toMatchObject({ statusCode: 200 });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspacePath: "E:/workspace", task: "fix test" }
    });
    expect(created.statusCode).toBe(201);
    const run = created.json();
    expect(run).toMatchObject({ status: "RUNNING", taskSummary: "fix test" });

    await expect(app.inject({ method: "GET", url: `/api/runs/${run.id}` })).resolves.toMatchObject({ statusCode: 200 });

    const cancelled = await app.inject({ method: "POST", url: `/api/runs/${run.id}/cancel` });
    expect(cancelled.json()).toMatchObject({ status: "CANCELLED", stopReason: "USER_CANCELLED" });

    const interrupted = await unitOfWork.repositories.runs.create({
      id: "run-interrupted",
      workspaceId: "workspace-2",
      taskSummary: "resume",
      status: "INTERRUPTED",
      configSnapshotId: "config-1",
      budgetUsage: { rounds: 0, tokens: 0, elapsedMs: 0, repeatedFailures: 0 },
      transitionIds: [],
      stopReason: "INTERRUPTED",
      stopDetail: null,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    expect(interrupted.id).toBe("run-interrupted");
    const cloned = await app.inject({ method: "POST", url: "/api/runs/run-interrupted/clone" });
    expect(cloned.statusCode).toBe(201);
    expect(cloned.json()).toMatchObject({ status: "PENDING", taskSummary: "resume" });
  });

  it("returns schema errors without creating runs", async () => {
    const unitOfWork = createInMemoryRepositories(new FakeClock());
    const app = createServerApp({ unitOfWork, clock: new FakeClock(), auth: { enabled: false } });

    const response = await app.inject({ method: "POST", url: "/api/runs", payload: { task: "" } });

    expect(response.statusCode).toBe(400);
    await expect(unitOfWork.repositories.runs.listActive()).resolves.toEqual([]);
  });
});
