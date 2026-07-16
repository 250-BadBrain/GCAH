import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createToolGateway } from "../src/index.js";
import { LocalExecutor } from "../src/executor/local-executor.js";
import { registerReadTools } from "../src/tools/read-tools.js";
import { createWorkspaceFence } from "@gcah/governance";
import type { Action, RunEvent } from "@gcah/shared";
import type { UnitOfWork } from "@gcah/core";

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "gcah-tools-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "a.txt"), "alpha");
  await writeFile(join(root, "src", "b.txt"), "bravo");
  await writeFile(join(root, "big.txt"), "x".repeat(32));
  return root;
}

function unitOfWork(): UnitOfWork {
  return {
    repositories: {} as never,
    transaction: async (work) => work({
      actions: { create: async (action: Action) => action, listByStep: async () => [] },
      events: { append: async (event: Omit<RunEvent, "cursor"> & { cursor?: number }) => ({ ...event, cursor: 1 }), listAfterCursor: async () => [] }
    } as never)
  };
}

function gatewayFor(executor: LocalExecutor): ReturnType<typeof createToolGateway> {
  return createToolGateway({
    runId: "run-1",
    actionIdFactory: () => "action-1",
    unitOfWork: unitOfWork(),
    governance: { decide: () => ({ result: "ALLOW", ruleId: "test", riskCategory: "low", explanation: "test" }) },
    approval: { authorize: () => ({ authorized: false, reason: "NO_GRANT" }) },
    registry: executor.registry
  });
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("read-only tools", () => {
  it("lists and reads bounded workspace files through the local executor", async () => {
    const root = await workspace();
    const executor = new LocalExecutor({
      workspaceRoot: root,
      fence: createWorkspaceFence({
        allowedWorkspaceRoots: [root],
        workspaceRoot: root,
        protectedRoots: []
      }),
      outputLimitBytes: 16
    });
    registerReadTools(executor);
    const gateway = gatewayFor(executor);

    await expect(gateway.execute({ tool: "list", args: { path: "src" } })).resolves.toMatchObject({
      status: "OK",
      summary: "a.txt\nb.txt"
    });
    await expect(gateway.execute({ tool: "read", args: { path: "big.txt" } })).resolves.toMatchObject({
      status: "OK",
      summary: `sha256=${sha("x".repeat(32))}\nxxxxxxxxxxxxxxxx\n[truncated]`
    });
  });

  it("rejects external paths and never requests validation", async () => {
    const root = await workspace();
    const executor = new LocalExecutor({
      workspaceRoot: root,
      fence: createWorkspaceFence({
        allowedWorkspaceRoots: [root],
        workspaceRoot: root,
        protectedRoots: []
      })
    });
    registerReadTools(executor);
    const gateway = gatewayFor(executor);

    await expect(gateway.execute({ tool: "read", args: { path: "../outside.txt" } })).resolves.toMatchObject({
      status: "ERROR",
      summary: "PATH_BOUNDARY_VIOLATION"
    });
    expect(executor.validationRequired).toBe(false);
  });
});
