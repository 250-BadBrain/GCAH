import { rm } from "node:fs/promises";

import type { LocalExecutor } from "../executor/local-executor.js";

export function registerDeleteTool(executor: LocalExecutor): void {
  executor.registry.register({
    tool: "delete",
    async execute(request, context) {
      const unauthorized = context?.authorized === true ? null : { status: "ERROR" as const, summary: "GATEWAY_AUTHORIZATION_REQUIRED" };
      if (unauthorized !== null) return unauthorized;
      const args = request.args as { path: string };
      const target = await executor.fence.resolveExistingTarget(args.path);
      await rm(target.absolutePath, { force: false });
      executor.validationRequired = true;
      return { status: "OK", summary: `deleted ${args.path}` };
    }
  });
}
