import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  const root = await mkdtemp(join(tmpdir(), "gcah-mutate-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "file.txt"), "old\n");
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

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("patch tool", () => {
  it("applies a one-file unified diff and marks validation required", async () => {
    const { root, executor, gateway } = await createExecutor();
    await expect(gateway.execute({
      tool: "patch",
      args: {
        path: "src/file.txt",
        baseSha256: sha("old\n"),
        unifiedDiff: "@@ -1 +1 @@\n-old\n+new"
      }
    })).resolves.toMatchObject({ status: "OK" });
    await expect(readFile(join(root, "src", "file.txt"), "utf8")).resolves.toBe("new\n");
    expect(executor.validationRequired).toBe(true);
  });

  it("applies a one-line diff to files without a trailing newline", async () => {
    const { root, gateway } = await createExecutor();
    await writeFile(join(root, "src", "file.txt"), "old");

    await expect(gateway.execute({
      tool: "patch",
      args: {
        path: "src/file.txt",
        baseSha256: sha("old"),
        unifiedDiff: "--- a/src/file.txt\n+++ b/src/file.txt\n@@ -1 +1 @@\n-old\n+new"
      }
    })).resolves.toMatchObject({ status: "OK" });
    await expect(readFile(join(root, "src", "file.txt"), "utf8")).resolves.toBe("new");
  });

  it("applies a multi-line hunk with context lines", async () => {
    const { root, gateway } = await createExecutor();
    const current = [
      "export function add(a: number, b: number): number {",
      "  return a - b;",
      "}",
      "",
      "export function multiply(a: number, b: number): number {",
      "  return a + b;",
      "}",
      "",
      "export function formatResult(value: number): string {",
      "  return `Value: ${value}`;",
      "}",
      ""
    ].join("\n");
    await writeFile(join(root, "src", "file.txt"), current);

    await expect(gateway.execute({
      tool: "patch",
      args: {
        path: "src/file.txt",
        baseSha256: sha(current),
        unifiedDiff: [
          "--- a/src/file.txt",
          "+++ b/src/file.txt",
          "@@ -1,11 +1,11 @@",
          " export function add(a: number, b: number): number {",
          "-  return a - b;",
          "+  return a + b;",
          " }",
          " ",
          " export function multiply(a: number, b: number): number {",
          "-  return a + b;",
          "+  return a * b;",
          " }",
          " ",
          " export function formatResult(value: number): string {",
          "-  return `Value: ${value}`;",
          "+  return `Result: ${value}`;",
          " }"
        ].join("\n")
      }
    })).resolves.toMatchObject({ status: "OK" });
    await expect(readFile(join(root, "src", "file.txt"), "utf8")).resolves.toContain("return a * b;");
  });

  it("rejects stale base without changing bytes", async () => {
    const { root, gateway } = await createExecutor();
    await expect(gateway.execute({
      tool: "patch",
      args: {
        path: "src/file.txt",
        baseSha256: sha("different\n"),
        unifiedDiff: "@@ -1 +1 @@\n-old\n+new"
      }
    })).resolves.toMatchObject({ status: "ERROR", summary: "STALE_BASE" });
    await expect(readFile(join(root, "src", "file.txt"), "utf8")).resolves.toBe("old\n");
  });
});
