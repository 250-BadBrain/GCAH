import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { LocalExecutor } from "../executor/local-executor.js";
import { boundOutput } from "./output-limit.js";

export function registerReadTool(executor: LocalExecutor): void {
  executor.registry.register({
    tool: "read",
    async execute(request) {
      const args = request.args as { path: string };
      const target = await executor.fence.resolveExistingTarget(args.path);
      const content = await readFile(target.absolutePath, "utf8");
      const output = boundOutput(content, executor.outputLimitBytes);
      return {
        status: "OK",
        summary: `sha256=${createHash("sha256").update(content).digest("hex")}\n${output.text}`
      };
    }
  });
}
