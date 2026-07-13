import { access } from "node:fs/promises";

import type { LocalExecutor } from "../executor/local-executor.js";
import { writeAtomically } from "./atomic-file.js";

export function registerWriteTool(executor: LocalExecutor): void {
  executor.registry.register({
    tool: "write",
    async execute(request) {
      const args = request.args as { path: string; content: string };
      const target = await executor.fence.resolveNewTarget(args.path);
      try {
        await access(target.absolutePath);
        return { status: "ERROR", summary: "TARGET_EXISTS" };
      } catch {
        await writeAtomically(target.absolutePath, args.content);
        executor.validationRequired = true;
        return { status: "OK", summary: `created ${args.path}` };
      }
    }
  });
}
