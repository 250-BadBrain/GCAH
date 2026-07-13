import { readdir } from "node:fs/promises";
import { basename } from "node:path";

import type { LocalExecutor } from "../executor/local-executor.js";
import { boundOutput } from "./output-limit.js";

export function registerListTool(executor: LocalExecutor): void {
  executor.registry.register({
    tool: "list",
    async execute(request) {
      const args = request.args as { path?: string };
      const target = await executor.fence.resolveExistingTarget(args.path ?? ".");
      const entries = await readdir(target.absolutePath, { withFileTypes: true });
      const names = entries
        .map((entry) => entry.isDirectory() ? `${basename(entry.name)}/` : basename(entry.name))
        .sort((left, right) => left.localeCompare(right));
      return {
        status: "OK",
        summary: boundOutput(names.join("\n"), executor.outputLimitBytes).text
      };
    }
  });
}
