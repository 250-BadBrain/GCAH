import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createToolGateway } from "../src/index.js";
import { LocalExecutor } from "../src/executor/local-executor.js";
import { registerMutationTools } from "../src/tools/mutation-tools.js";
import { createWorkspaceFence } from "@gcah/governance";
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

async function createExecutor(): Promise<{ root: string; executor: LocalExecutor; gateway: ReturnType<typeof createToolGateway> }> {
  const root = await mkdtemp(join(tmpdir(), "gcah-write-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "file.txt"), "old");
  const local = new LocalExecutor({
    workspaceRoot: root,
    fence: createWorkspaceFence({ allowedWorkspaceRoots: [root], workspaceRoot: root, protectedRoots: [] })
  });
  registerMutationTools(local);
  const gateway = createToolGateway({
    runId: "run-1",
    actionIdFactory: () => "action-1",
    unitOfWork: unitOfWork(),
    governance: { decide: () => ({ result: "ALLOW", ruleId: "test", riskCategory: "low", explanation: "test" }) },
    approval: { authorize: () => ({ authorized: true, grant: { id: "grant-1", runId: "run-1", normalizedActionHash: "hash", scopeHash: "scope", expiresAtRound: 1, grantedBy: "human" } }) },
    registry: local.registry
  });
  return { root, executor: local, gateway };
}

describe("write and delete tools", () => {
  it("creates only absent files and rejects overwrites without approval precondition", async () => {
    const { root, gateway } = await createExecutor();
    await expect(gateway.execute({ tool: "write", args: { path: "src/new.txt", content: "new" } })).resolves.toMatchObject({
      status: "OK"
    });
    await expect(readFile(join(root, "src", "new.txt"), "utf8")).resolves.toBe("new");
    await expect(gateway.execute({ tool: "write", args: { path: "src/file.txt", content: "overwrite" } })).resolves.toMatchObject({
      status: "ERROR",
      summary: "TARGET_EXISTS"
    });
  });

  it("deletes existing files explicitly and marks validation required", async () => {
    const { root, executor, gateway } = await createExecutor();
    await expect(gateway.execute({ tool: "delete", args: { path: "src/file.txt" } })).resolves.toMatchObject({
      status: "OK"
    });
    await expect(readFile(join(root, "src", "file.txt"), "utf8")).rejects.toThrow();
    expect(executor.validationRequired).toBe(true);
  });
});
