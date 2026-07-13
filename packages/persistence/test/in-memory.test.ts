import { describe, expect, it } from "vitest";

import { createInMemoryRepositories } from "../src/index.js";
import type { Clock } from "@gcah/core";
import type { Action, ConfigSnapshot, MemoryEntry, Run, RunEvent, Step } from "@gcah/shared";

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

function step(id: string, sequence: number): Step {
  return {
    id,
    runId: "run-1",
    sequence,
    contextSummary: "context",
    llmUsage: null,
    usageMissing: false,
    status: "PENDING",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function action(id: string): Action {
  return {
    id,
    stepId: "step-1",
    kind: "tool",
    toolName: "read",
    finishSummary: null,
    args: { path: "README.md" },
    displayRationale: "read",
    normalizedSummary: "read README.md",
    riskCategory: "low",
    status: "PROPOSED",
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

  it("enforces serial step sequences and stores actions", async () => {
    const store = createInMemoryRepositories(new FakeClock());
    await store.repositories.runs.create(run("run-1"));
    await expect(store.repositories.steps.create(step("step-1", 1))).resolves.toMatchObject({ id: "step-1" });
    await expect(store.repositories.steps.create(step("step-2", 1))).rejects.toThrow(/duplicate step sequence/u);
    await expect(store.repositories.actions.create(action("action-1"))).resolves.toMatchObject({ id: "action-1" });
    await expect(store.repositories.actions.listByStep("step-1")).resolves.toEqual([action("action-1")]);
  });

  it("rolls back transaction writes and event cursors on failure", async () => {
    const store = createInMemoryRepositories(new FakeClock());
    await expect(store.transaction(async (repositories) => {
      await repositories.runs.create(run("run-rollback"));
      await repositories.events.append({
        id: "event-rollback",
        runId: "run-rollback",
        stepId: null,
        type: "run.started",
        relatedEntityId: "run-rollback",
        summary: "started",
        createdAt: timestamp
      });
      throw new Error("abort");
    })).rejects.toThrow("abort");

    await expect(store.repositories.runs.getById("run-rollback")).resolves.toBeNull();
    await expect(store.repositories.events.append({
      id: "event-1",
      runId: "run-1",
      stepId: null,
      type: "run.started",
      relatedEntityId: "run-1",
      summary: "started",
      createdAt: timestamp
    })).resolves.toMatchObject({ cursor: 1 });
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
