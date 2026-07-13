import { access, realpath } from "node:fs/promises";
import path from "node:path";

import { PathBoundaryError } from "./path-error.js";

export interface WorkspaceFenceOptions {
  allowedWorkspaceRoots: string[];
  workspaceRoot: string;
  protectedRoots: string[];
  fs?: {
    access(path: string): Promise<void>;
    realpath(path: string): Promise<string>;
  };
}

export type WorkspaceFenceResult = {
  ok: true;
  absolutePath?: string;
};

export interface WorkspaceFence {
  validateWorkspace(): Promise<WorkspaceFenceResult>;
  resolveExistingTarget(relativePath: string): Promise<WorkspaceFenceResult & { absolutePath: string }>;
  resolveNewTarget(relativePath: string): Promise<WorkspaceFenceResult & { absolutePath: string }>;
}

const defaultFs = { access, realpath };

function comparable(value: string): string {
  const normalized = path.resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function containsOrEquals(parent: string, child: string): boolean {
  const parentValue = comparable(parent);
  const childValue = comparable(child);
  if (parentValue === childValue) return true;
  const relative = path.relative(parentValue, childValue);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function rejectAbsoluteOrEmpty(targetPath: string): void {
  if (targetPath.length === 0 || path.isAbsolute(targetPath)) {
    throw new PathBoundaryError("target path must be relative to the workspace");
  }
}

export function createWorkspaceFence(options: WorkspaceFenceOptions): WorkspaceFence {
  const fs = options.fs ?? defaultFs;

  async function workspaceRealpath(): Promise<string> {
    return realpathOrBoundary(options.workspaceRoot);
  }

  async function realpathOrBoundary(targetPath: string): Promise<string> {
    try {
      return await fs.realpath(targetPath);
    } catch {
      throw new PathBoundaryError("path cannot be resolved inside the workspace boundary");
    }
  }

  async function validateWorkspace(): Promise<WorkspaceFenceResult> {
    const workspace = await workspaceRealpath();
    const allowedRoots = await Promise.all(options.allowedWorkspaceRoots.map((root) => realpathOrBoundary(root)));
    if (!allowedRoots.some((root) => containsOrEquals(root, workspace))) {
      throw new PathBoundaryError("workspace is outside allowed roots");
    }

    const protectedRoots = await Promise.all(options.protectedRoots.map((root) => realpathOrBoundary(root)));
    for (const protectedRoot of protectedRoots) {
      if (containsOrEquals(protectedRoot, workspace) || containsOrEquals(workspace, protectedRoot)) {
        throw new PathBoundaryError("workspace overlaps a protected root");
      }
    }
    return { ok: true };
  }

  async function assertInsideWorkspace(absoluteTarget: string): Promise<string> {
    const workspace = await workspaceRealpath();
    if (!containsOrEquals(workspace, absoluteTarget)) {
      throw new PathBoundaryError("target escapes workspace");
    }
    return path.resolve(absoluteTarget);
  }

  async function resolveExistingTarget(relativePath: string): Promise<WorkspaceFenceResult & { absolutePath: string }> {
    rejectAbsoluteOrEmpty(relativePath);
    await validateWorkspace();
    const workspace = await workspaceRealpath();
    const target = await realpathOrBoundary(path.resolve(workspace, relativePath));
    return { ok: true, absolutePath: await assertInsideWorkspace(target) };
  }

  async function nearestExistingParent(candidate: string): Promise<string> {
    let current = path.dirname(candidate);
    while (current !== path.dirname(current)) {
      try {
        await fs.access(current);
        return realpathOrBoundary(current);
      } catch {
        current = path.dirname(current);
      }
    }
    return realpathOrBoundary(current);
  }

  async function resolveNewTarget(relativePath: string): Promise<WorkspaceFenceResult & { absolutePath: string }> {
    rejectAbsoluteOrEmpty(relativePath);
    await validateWorkspace();
    const workspace = await workspaceRealpath();
    const absoluteTarget = path.resolve(workspace, relativePath);
    const parent = await nearestExistingParent(absoluteTarget);
    await assertInsideWorkspace(parent);
    return { ok: true, absolutePath: await assertInsideWorkspace(absoluteTarget) };
  }

  return {
    validateWorkspace,
    resolveExistingTarget,
    resolveNewTarget
  };
}
