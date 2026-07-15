import { cp, rm } from "node:fs/promises";

export interface ResetDemoWorkspaceOptions {
  templateDir: string;
  targetDir: string;
}

export interface DemoWorkspace {
  rootPath: string;
}

export async function resetDemoWorkspace(options: ResetDemoWorkspaceOptions): Promise<DemoWorkspace> {
  await rm(options.targetDir, { recursive: true, force: true });
  await cp(options.templateDir, options.targetDir, { recursive: true, force: true });
  return { rootPath: options.targetDir };
}
