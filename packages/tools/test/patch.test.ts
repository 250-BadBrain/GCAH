import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LocalExecutor, registerMutationTools } from "../src/index.js";
import { createWorkspaceFence } from "@gcah/governance";

async function createExecutor(): Promise<{ root: string; executor: LocalExecutor }> {
  const root = await mkdtemp(join(tmpdir(), "gcah-mutate-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "file.txt"), "old\n");
  const local = new LocalExecutor({
    workspaceRoot: root,
    fence: createWorkspaceFence({ allowedWorkspaceRoots: [root], workspaceRoot: root, protectedRoots: [] })
  });
  registerMutationTools(local);
  return { root, executor: local };
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("patch tool", () => {
  it("applies a one-file unified diff and marks validation required", async () => {
    const { root, executor } = await createExecutor();
    await expect(executor.execute({
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

  it("rejects stale base without changing bytes", async () => {
    const { root, executor } = await createExecutor();
    await expect(executor.execute({
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
