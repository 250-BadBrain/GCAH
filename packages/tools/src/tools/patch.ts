import { readFile } from "node:fs/promises";

import type { LocalExecutor } from "../executor/local-executor.js";
import { writeAtomically } from "./atomic-file.js";
import { sha256File } from "./file-hash.js";
import { applySingleHunk } from "./unified-diff.js";

export function registerPatchTool(executor: LocalExecutor): void {
  executor.registry.register({
    tool: "patch",
    async execute(request, context) {
      const unauthorized = context?.authorized === true ? null : { status: "ERROR" as const, summary: "GATEWAY_AUTHORIZATION_REQUIRED" };
      if (unauthorized !== null) return unauthorized;
      const args = request.args as { path: string; baseSha256: string; unifiedDiff: string };
      const target = await executor.fence.resolveExistingTarget(args.path);
      if (await sha256File(target.absolutePath) !== args.baseSha256) {
        return { status: "ERROR", summary: "STALE_BASE" };
      }
      const next = applySingleHunk(await readFile(target.absolutePath, "utf8"), args.unifiedDiff);
      await writeAtomically(target.absolutePath, next);
      executor.validationRequired = true;
      return { status: "OK", summary: `patched ${args.path}` };
    }
  });
}
