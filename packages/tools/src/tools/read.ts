import { readFile } from "node:fs/promises";

import type { LocalExecutor } from "../executor/local-executor.js";
import { boundOutput } from "./output-limit.js";

export function registerReadTool(executor: LocalExecutor): void {
  executor.registry.register({
    tool: "read",
    async execute(request) {
      const args = request.args as { path: string };
      const target = await executor.fence.resolveExistingTarget(args.path);
      const output = boundOutput(await readFile(target.absolutePath, "utf8"), executor.outputLimitBytes);
      return {
        status: "OK",
        summary: output.text
      };
    }
  });
}
