import { rm } from "node:fs/promises";

import type { LocalExecutor } from "../executor/local-executor.js";

export function registerDeleteTool(executor: LocalExecutor): void {
  executor.registry.register({
    tool: "delete",
    async execute(request) {
      const args = request.args as { path: string };
      const target = await executor.fence.resolveExistingTarget(args.path);
      await rm(target.absolutePath, { force: false });
      executor.validationRequired = true;
      return { status: "OK", summary: `deleted ${args.path}` };
    }
  });
}
