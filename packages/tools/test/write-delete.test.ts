import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LocalExecutor, registerMutationTools } from "../src/index.js";
import { createWorkspaceFence } from "@gcah/governance";

async function createExecutor(): Promise<{ root: string; executor: LocalExecutor }> {
  const root = await mkdtemp(join(tmpdir(), "gcah-write-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "file.txt"), "old");
  const local = new LocalExecutor({
    workspaceRoot: root,
    fence: createWorkspaceFence({ allowedWorkspaceRoots: [root], workspaceRoot: root, protectedRoots: [] })
  });
  registerMutationTools(local);
  return { root, executor: local };
}

describe("write and delete tools", () => {
  it("creates only absent files and rejects overwrites without approval precondition", async () => {
    const { root, executor } = await createExecutor();
    await expect(executor.execute({ tool: "write", args: { path: "src/new.txt", content: "new" } })).resolves.toMatchObject({
      status: "OK"
    });
    await expect(readFile(join(root, "src", "new.txt"), "utf8")).resolves.toBe("new");
    await expect(executor.execute({ tool: "write", args: { path: "src/file.txt", content: "overwrite" } })).resolves.toMatchObject({
      status: "ERROR",
      summary: "TARGET_EXISTS"
    });
  });

  it("deletes existing files explicitly and marks validation required", async () => {
    const { root, executor } = await createExecutor();
    await expect(executor.execute({ tool: "delete", args: { path: "src/file.txt" } })).resolves.toMatchObject({
      status: "OK"
    });
    await expect(readFile(join(root, "src", "file.txt"), "utf8")).rejects.toThrow();
    expect(executor.validationRequired).toBe(true);
  });
});
