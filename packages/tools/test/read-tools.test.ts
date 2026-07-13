import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LocalExecutor, registerReadTools } from "../src/index.js";
import { createWorkspaceFence } from "@gcah/governance";

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "gcah-tools-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "a.txt"), "alpha");
  await writeFile(join(root, "src", "b.txt"), "bravo");
  await writeFile(join(root, "big.txt"), "x".repeat(32));
  return root;
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

    await expect(executor.execute({ tool: "list", args: { path: "src" } })).resolves.toMatchObject({
      status: "OK",
      summary: "a.txt\nb.txt"
    });
    await expect(executor.execute({ tool: "read", args: { path: "big.txt" } })).resolves.toMatchObject({
      status: "OK",
      summary: "xxxxxxxxxxxxxxxx\n[truncated]"
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

    await expect(executor.execute({ tool: "read", args: { path: "../outside.txt" } })).resolves.toMatchObject({
      status: "ERROR",
      summary: "PATH_BOUNDARY_VIOLATION"
    });
    expect(executor.validationRequired).toBe(false);
  });
});
