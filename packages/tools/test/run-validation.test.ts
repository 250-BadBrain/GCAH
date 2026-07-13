import { describe, expect, it } from "vitest";

import { createToolGateway, CommandValidationRunner } from "../src/index.js";
import { CommandRunner } from "../src/command/command-runner.js";
import { registerValidationTool } from "../src/tools/run-validation.js";
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

describe("run_validation tool", () => {
  it("routes validator IDs to configured commands without accepting executable overrides", async () => {
    const runner = new CommandRunner(async (request) => ({ status: "OK", summary: request.executable }));
    registerValidationTool({
      registry: runner.registry,
      runner,
      validators: {
        test: { executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }
      }
    });

    await expect(gatewayFor(runner).execute({ tool: "run_validation", args: { kind: "test" } })).resolves.toEqual({
      status: "OK",
      summary: "pnpm"
    });
    await expect(gatewayFor(runner).execute({ tool: "run_validation", args: { kind: "custom", executable: "rm" } })).resolves.toMatchObject({
      status: "ERROR"
    });

    await expect(new CommandValidationRunner(runner, {
      test: { executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }
    }).runRequired()).resolves.toMatchObject([{ result: "PASS", commandSnapshot: "pnpm test" }]);
  });
});
