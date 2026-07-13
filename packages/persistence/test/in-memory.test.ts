import { describe, expect, it } from "vitest";

import { createInMemoryRepositories } from "../src/index.js";
import type { Clock } from "@gcah/core";
import type { ConfigSnapshot, MemoryEntry, Run, RunEvent } from "@gcah/shared";

const timestamp = "2026-07-13T00:00:00.000Z";

class FakeClock implements Clock {
  now(): Date {
    return new Date(timestamp);
  }

  nowIso(): string {
    return timestamp;
  }
}

function run(id: string, workspaceId = "workspace-1", status: Run["status"] = "RUNNING"): Run {
  return {
    id,
    workspaceId,
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

describe("in-memory repositories", () => {
  it("enforces one active run per workspace, clone safety, and event cursors", async () => {
    const store = createInMemoryRepositories(new FakeClock());

    const created = await store.repositories.runs.create(run("run-1"));
    created.taskSummary = "mutated";
    await expect(store.repositories.runs.getById("run-1")).resolves.toMatchObject({ taskSummary: "task" });
    await expect(store.repositories.runs.create(run("run-2"))).rejects.toThrow(/active run/u);

    await store.repositories.runs.update({
      ...run("run-1"),
      status: "COMPLETED",
      stopReason: "COMPLETED"
    });
    await expect(store.repositories.runs.create(run("run-2"))).resolves.toMatchObject({ id: "run-2" });

    const firstEvent: Omit<RunEvent, "cursor"> = {
      id: "event-1",
      runId: "run-2",
      stepId: null,
      type: "run.started",
      relatedEntityId: "run-2",
      summary: "started",
      createdAt: timestamp
    };
    await expect(store.repositories.events.append(firstEvent)).resolves.toMatchObject({ cursor: 1 });
    await expect(store.repositories.events.append({ ...firstEvent, id: "event-2" })).resolves.toMatchObject({ cursor: 2 });
    await expect(store.repositories.events.listAfterCursor("run-2", 0)).resolves.toMatchObject([
      { cursor: 1 },
      { cursor: 2 }
    ]);
  });

  it("stores config and memory through the UnitOfWork facade", async () => {
    const store = createInMemoryRepositories(new FakeClock());
    const config: ConfigSnapshot = {
      id: "config-1",
      schemaVersion: 1,
      allowedWorkspaceRoots: ["E:/Desktop"],
      nonSensitiveConfig: {},
      contentHash: "hash",
      createdAt: timestamp
    };
    const memory: MemoryEntry = {
      id: "memory-1",
      workspaceId: "workspace-1",
      type: "project_constraint",
      tags: ["policy"],
      keywords: ["workspace"],
      sourceRunId: "run-1",
      summary: "stay inside workspace",
      createdAt: timestamp
    };

    await store.transaction(async (repositories) => {
      await repositories.config.createSnapshot(config);
      await repositories.memory.add(memory);
    });

    await expect(store.repositories.config.getSnapshot("config-1")).resolves.toEqual(config);
    await expect(store.repositories.memory.search({ workspaceId: "workspace-1", query: "workspace" })).resolves.toEqual([memory]);
  });
});
