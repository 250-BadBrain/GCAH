import { describe, expect, it } from "vitest";

import {
  SystemClock,
  type Clock,
  type ConfigRepository,
  type EventRepository,
  type LlmClientPort,
  type MemoryRepository,
  type RepositorySet,
  type RunRepository,
  type StepRepository,
  type ActionRepository,
  type ToolGatewayPort,
  type UnitOfWork,
  type ValidationRunner,
  type WorkspaceFencePort
} from "../src/index.js";

describe("core ports", () => {
  it("defines injectable repository and service ports", async () => {
    const clock: Clock = new SystemClock();
    expect(clock.nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const runs: RunRepository = {
      create: async (run) => run,
      getById: async () => null,
      findActiveByWorkspace: async () => null,
      update: async (run) => run
    };
    const events: EventRepository = {
      append: async (event) => ({ ...event, cursor: 1 }),
      listAfterCursor: async () => []
    };
    const steps: StepRepository = {
      create: async (step) => step,
      listByRun: async () => []
    };
    const actions: ActionRepository = {
      create: async (action) => action,
      listByStep: async () => []
    };
    const memory: MemoryRepository = {
      add: async (entry) => entry,
      search: async () => []
    };
    const config: ConfigRepository = {
      createSnapshot: async (snapshot) => snapshot,
      getSnapshot: async () => null
    };
    const repositories: RepositorySet = { runs, steps, actions, events, memory, config };
    const unitOfWork: UnitOfWork = {
      repositories,
      transaction: async (work) => work(repositories)
    };
    const toolGateway: ToolGatewayPort = {
      execute: async () => ({ status: "OK", summary: "executed" })
    };
    const validationRunner: ValidationRunner = {
      runRequired: async () => []
    };
    const workspaceFence: WorkspaceFencePort = {
      validateWorkspace: async () => ({ ok: true }),
      resolveExistingTarget: async (path) => ({ ok: true, absolutePath: path }),
      resolveNewTarget: async (path) => ({ ok: true, absolutePath: path })
    };
    const llm: LlmClientPort = {
      complete: async () => ({
        response: { kind: "finish", summary: "done", rationale: "complete" },
        usage: null
      })
    };

    await expect(unitOfWork.transaction(async (repo) => repo.runs.findActiveByWorkspace("workspace-1"))).resolves.toBeNull();
    await expect(toolGateway.execute({ tool: "read", args: { path: "README.md" } })).resolves.toEqual({
      status: "OK",
      summary: "executed"
    });
    await expect(validationRunner.runRequired()).resolves.toEqual([]);
    await expect(workspaceFence.validateWorkspace()).resolves.toEqual({ ok: true });
    await expect(llm.complete([])).resolves.toMatchObject({ response: { kind: "finish" } });
  });
});
