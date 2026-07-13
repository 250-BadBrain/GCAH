import { describe, expect, it } from "vitest";

import { createToolGateway } from "../src/index.js";
import { CommandRunner } from "../src/command/command-runner.js";
import { registerCommandTools } from "../src/tools/run-command.js";
import type { Action, RunEvent } from "@gcah/shared";
import type { UnitOfWork } from "@gcah/core";

function unitOfWork(): UnitOfWork {
  return {
    repositories: {} as never,
    transaction: async (work) => work({
      actions: { create: async (action: Action) => action, listByStep: async () => [] },
      events: { append: async (event: Omit<RunEvent, "cursor"> & { cursor?: number }) => ({ ...event, cursor: 1 }), listAfterCursor: async () => [] }
    } as never)
  };
}

function gatewayFor(runner: CommandRunner): ReturnType<typeof createToolGateway> {
  return createToolGateway({
    runId: "run-1",
    actionIdFactory: () => "action-1",
    unitOfWork: unitOfWork(),
    governance: { decide: () => ({ result: "ALLOW", ruleId: "test", riskCategory: "low", explanation: "test" }) },
    approval: { authorize: () => ({ authorized: true, grant: { id: "grant-1", runId: "run-1", normalizedActionHash: "hash", scopeHash: "scope", expiresAtRound: 1, grantedBy: "human" } }) },
    registry: runner.registry
  });
}

describe("run_command tool", () => {
  it("dispatches configured commands with shell false", async () => {
    const runner = new CommandRunner(async (request) => ({
      status: "OK",
      summary: `${request.executable} ${request.args.join(" ")} shell:${String(request.shell)}`
    }));
    registerCommandTools({
      registry: runner.registry,
      runner,
      templates: [{ id: "test", executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }],
      publicDemo: false
    });

    await expect(gatewayFor(runner).execute({
      tool: "run_command",
      args: { executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }
    })).resolves.toEqual({
      status: "OK",
      summary: "pnpm test shell:false"
    });
  });

  it("rejects undeclared commands and public demo execution", async () => {
    const runner = new CommandRunner(async () => ({ status: "OK", summary: "bad" }));
    registerCommandTools({ registry: runner.registry, runner, templates: [], publicDemo: true });
    await expect(gatewayFor(runner).execute({
      tool: "run_command",
      args: { executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }
    })).resolves.toMatchObject({ status: "ERROR" });
  });
});
