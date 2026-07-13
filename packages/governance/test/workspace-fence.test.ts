import { mkdtemp, mkdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createWorkspaceFence, PathBoundaryError } from "../src/index.js";

async function fixture(): Promise<{
  root: string;
  allowed: string;
  workspace: string;
  protectedRoot: string;
  external: string;
}> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "gcah-fence-")));
  const allowed = join(root, "allowed");
  const workspace = join(allowed, "workspace");
  const protectedRoot = join(root, "gcah-data");
  const external = join(root, "external");
  await mkdir(join(workspace, "src"), { recursive: true });
  await mkdir(protectedRoot, { recursive: true });
  await mkdir(external, { recursive: true });
  await writeFile(join(workspace, "src", "file.txt"), "ok");
  await writeFile(join(external, "secret.txt"), "no");
  return { root, allowed, workspace, protectedRoot, external };
}

describe("workspace fence", () => {
  it("accepts a workspace under an allowed root and resolves safe targets", async () => {
    const { allowed, workspace, protectedRoot } = await fixture();
    const fence = createWorkspaceFence({
      allowedWorkspaceRoots: [allowed],
      workspaceRoot: workspace,
      protectedRoots: [protectedRoot]
    });

    await expect(fence.validateWorkspace()).resolves.toEqual({ ok: true });
    await expect(fence.resolveExistingTarget("src/file.txt")).resolves.toMatchObject({
      ok: true
    });
    await expect(fence.resolveNewTarget("src/new-file.txt")).resolves.toMatchObject({
      ok: true
    });
  });

  it("rejects workspaces outside allowed roots and protected-root overlaps", async () => {
    const { root, allowed, workspace, protectedRoot } = await fixture();

    await expect(createWorkspaceFence({
      allowedWorkspaceRoots: [join(root, "other")],
      workspaceRoot: workspace,
      protectedRoots: []
    }).validateWorkspace()).rejects.toThrow(PathBoundaryError);

    for (const badWorkspace of [
      protectedRoot,
      root,
      join(protectedRoot, "child")
    ]) {
      await expect(createWorkspaceFence({
        allowedWorkspaceRoots: [allowed, root],
        workspaceRoot: badWorkspace,
        protectedRoots: [protectedRoot]
      }).validateWorkspace()).rejects.toThrow(PathBoundaryError);
    }
  });

  it("rejects traversal and absolute external paths", async () => {
    const { allowed, workspace, protectedRoot, external } = await fixture();
    const fence = createWorkspaceFence({
      allowedWorkspaceRoots: [allowed],
      workspaceRoot: workspace,
      protectedRoots: [protectedRoot]
    });
    await fence.validateWorkspace();

    await expect(fence.resolveExistingTarget("../external/secret.txt")).rejects.toThrow(PathBoundaryError);
    await expect(fence.resolveExistingTarget(join(external, "secret.txt"))).rejects.toThrow(PathBoundaryError);
  });

  it("rejects symlink-like realpath escapes through the injected filesystem", async () => {
    const workspace = "C:\\allowed\\workspace";
    const outside = "C:\\external\\secret.txt";
    const fence = createWorkspaceFence({
      allowedWorkspaceRoots: ["C:\\allowed"],
      workspaceRoot: workspace,
      protectedRoots: [],
      fs: {
        access: async () => {},
        realpath: async (input) => {
          const normalized = input.replaceAll("/", "\\");
          if (normalized.endsWith("\\src\\outside-link.txt")) return outside;
          return normalized;
        }
      }
    });

    await expect(fence.resolveExistingTarget("src/outside-link.txt")).rejects.toThrow(PathBoundaryError);
  });

  it("checks the nearest existing parent for new targets", async () => {
    const { allowed, workspace, protectedRoot } = await fixture();
    const fence = createWorkspaceFence({
      allowedWorkspaceRoots: [allowed],
      workspaceRoot: workspace,
      protectedRoots: [protectedRoot]
    });

    await expect(fence.resolveNewTarget("src/deep/new.txt")).resolves.toMatchObject({ ok: true });
    await expect(fence.resolveNewTarget("../external/new.txt")).rejects.toThrow(PathBoundaryError);
  });
});
