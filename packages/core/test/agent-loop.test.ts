import { describe, expect, it } from "vitest";

import {
  AgentLoop,
  createConfigSnapshot,
  type Clock,
  type ToolGatewayPort,
  type UnitOfWork,
  type ValidationRunner
} from "../src/index.js";
import type { Action, ConfigSnapshot, MemoryEntry, Run, RunEvent, Step, ValidationResult } from "@gcah/shared";
import type { LlmClientPort, LlmClientResult } from "../src/index.js";

class FakeClock implements Clock {
  private ticks = 0;
  now(): Date {
    this.ticks += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, this.ticks));
  }
  nowIso(): string {
    return this.now().toISOString();
  }
}

class ScriptedClient implements LlmClientPort {
  readonly messages: unknown[][] = [];
  private cursor = 0;
  constructor(private readonly script: readonly LlmClientResult[]) {}
  async complete(messages: readonly unknown[]): Promise<LlmClientResult> {
    this.messages.push([...messages]);
    const next = this.script[this.cursor];
    this.cursor += 1;
    if (next === undefined) throw new Error("script exhausted");
    return next;
  }
}

class SequencedValidationRunner implements ValidationRunner {
  calls = 0;
  constructor(private readonly results: readonly ValidationResult[]) {}
  async runValidator(validatorId: string, configSnapshot: ConfigSnapshot): Promise<ValidationResult> {
    expect(configSnapshot.id).toMatch(/^config:/u);
    const result = this.results[this.calls];
    this.calls += 1;
    if (result === undefined) throw new Error(`missing validation result for ${validatorId}`);
    return result;
  }
}

function config(): ConfigSnapshot {
  return createConfigSnapshot({
    mode: "local",
    budgets: { maxRounds: 8, maxTokens: 1000, maxElapsedMs: 10000 },
    validation: { required: ["test"] },
    riskThresholds: { requireApproval: "medium", deny: "high" },
    commands: { test: "pnpm test" },
    allowedWorkspaceRoots: ["E:/workspace"],
    executorBackend: "local",
    llm: { provider: "mock" }
  });
}

function validation(result: "PASS" | "FAIL", id: string): ValidationResult {
  return {
    id,
    actionId: "action",
    type: "test",
    commandSnapshot: "pnpm test",
    result,
    failureCategory: null,
    failureFingerprint: null,
    diagnosticSummary: result === "PASS" ? null : "AssertionError src/app.ts:10",
    durationMs: 1,
    createdAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("AgentLoop", () => {
  it("persists serial steps, feeds validation failure back, and blocks completion until validation passes", async () => {
    const clock = new FakeClock();
    const unitOfWork = createTestUnitOfWork();
    const client = new ScriptedClient([
      { response: { kind: "tool", tool: "write", args: { path: "src/app.ts", content: "bad" }, rationale: "try patch" }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      { response: { kind: "finish", summary: "done too soon", rationale: "complete" }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      { response: { kind: "tool", tool: "patch", args: { path: "src/app.ts", baseSha256: "0".repeat(64), unifiedDiff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@\n-bad\n+good\n" }, rationale: "fix test" }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      { response: { kind: "finish", summary: "done", rationale: "complete" }, usage: null }
    ]);
    const validationRunner = new SequencedValidationRunner([validation("FAIL", "validation-1"), validation("PASS", "validation-2")]);
    const toolGateway: ToolGatewayPort = {
      execute: async () => ({ status: "OK", summary: "tool ok" })
    };

    const loop = new AgentLoop({ clock, unitOfWork, llm: client, toolGateway, validationRunner });
    await loop.start({ runId: "run-1", workspaceId: "workspace-1", taskSummary: "fix failing test", configSnapshot: config(), maxSteps: 6 });

    await expect(unitOfWork.repositories.runs.getById("run-1")).resolves.toMatchObject({ status: "COMPLETED", stopReason: "COMPLETED" });
    await expect(unitOfWork.repositories.steps.listByRun("run-1")).resolves.toHaveLength(4);
    expect(String(client.messages[1]?.[0])).toContain("Validation failed");
    expect(validationRunner.calls).toBe(2);
  });

  it("persists a proposed action before executing the tool", async () => {
    const clock = new FakeClock();
    const unitOfWork = createTestUnitOfWork();
    const client = new ScriptedClient([
      { response: { kind: "tool", tool: "read", args: { path: "README.md" }, rationale: "inspect" }, usage: null },
      { response: { kind: "finish", summary: "done", rationale: "complete" }, usage: null }
    ]);
    const toolGateway: ToolGatewayPort = {
      execute: async (request) => {
        expect(request.tool).toBe("read");
        const events = await unitOfWork.repositories.events.listAfterCursor("run-2", 0);
        expect(events.some((event) => event.type === "action.proposed")).toBe(true);
        return { status: "OK", summary: "read ok" };
      }
    };

    const loop = new AgentLoop({
      clock,
      unitOfWork: unitOfWork as UnitOfWork,
      llm: client,
      toolGateway,
      validationRunner: new SequencedValidationRunner([])
    });
    await loop.start({ runId: "run-2", workspaceId: "workspace-1", taskSummary: "inspect", configSnapshot: config(), maxSteps: 3 });
  });

  it("stops when the injected tool gateway denies or rejects an action", async () => {
    const clock = new FakeClock();
    const unitOfWork = createTestUnitOfWork();
    const client = new ScriptedClient([
      { response: { kind: "tool", tool: "write", args: { path: "src/app.ts", content: "danger" }, rationale: "dangerous write" }, usage: null }
    ]);
    const loop = new AgentLoop({
      clock,
      unitOfWork,
      llm: client,
      toolGateway: { execute: async () => ({ status: "ERROR", summary: "DENY policy" }) },
      validationRunner: new SequencedValidationRunner([])
    });

    await loop.start({ runId: "run-3", workspaceId: "workspace-1", taskSummary: "run dangerous command", configSnapshot: config(), maxSteps: 2 });

    await expect(unitOfWork.repositories.runs.getById("run-3")).resolves.toMatchObject({
      status: "STOPPED",
      stopReason: "POLICY_DENIED"
    });
  });
});

function createTestUnitOfWork(): UnitOfWork {
  const runs = new Map<string, Run>();
  const steps = new Map<string, Step>();
  const actions = new Map<string, Action>();
  const events = new Map<string, RunEvent[]>();
  const memory = new Map<string, MemoryEntry>();
  const configs = new Map<string, ConfigSnapshot>();
  const repositories: UnitOfWork["repositories"] = {
    runs: {
      create: async (run) => {
        runs.set(run.id, structuredClone(run));
        return structuredClone(run);
      },
      getById: async (id) => structuredClone(runs.get(id) ?? null),
      findActiveByWorkspace: async (workspaceId) => structuredClone([...runs.values()].find((run) => run.workspaceId === workspaceId && ["PENDING", "RUNNING", "WAITING_APPROVAL"].includes(run.status)) ?? null),
      listActive: async () => [...runs.values()].filter((run) => ["PENDING", "RUNNING", "WAITING_APPROVAL"].includes(run.status)).map((run) => structuredClone(run)),
      update: async (run) => {
        runs.set(run.id, structuredClone(run));
        return structuredClone(run);
      }
    },
    steps: {
      create: async (step) => {
        steps.set(step.id, structuredClone(step));
        return structuredClone(step);
      },
      listByRun: async (runId) => [...steps.values()].filter((step) => step.runId === runId).sort((left, right) => left.sequence - right.sequence).map((step) => structuredClone(step))
    },
    actions: {
      create: async (action) => {
        actions.set(action.id, structuredClone(action));
        return structuredClone(action);
      },
      listByStep: async (stepId) => [...actions.values()].filter((action) => action.stepId === stepId).map((action) => structuredClone(action))
    },
    events: {
      append: async (event) => {
        const existing = events.get(event.runId) ?? [];
        const persisted = { ...event, cursor: existing.length + 1 } satisfies RunEvent;
        existing.push(structuredClone(persisted));
        events.set(event.runId, existing);
        return structuredClone(persisted);
      },
      listAfterCursor: async (runId, cursor) => (events.get(runId) ?? []).filter((event) => event.cursor > cursor).map((event) => structuredClone(event))
    },
    memory: {
      add: async (entry) => {
        memory.set(entry.id, structuredClone(entry));
        return structuredClone(entry);
      },
      search: async () => []
    },
    config: {
      createSnapshot: async (snapshot) => {
        configs.set(snapshot.id, structuredClone(snapshot));
        return structuredClone(snapshot);
      },
      getSnapshot: async (id) => structuredClone(configs.get(id) ?? null)
    }
  };
  return {
    repositories,
    transaction: async (work) => work(repositories)
  };
}
