import type { LocalExecutor } from "../executor/local-executor.js";
import { registerDeleteTool } from "./delete.js";
import { registerPatchTool } from "./patch.js";
import { registerWriteTool } from "./write.js";

export function registerMutationTools(executor: LocalExecutor): void {
  registerPatchTool(executor);
  registerWriteTool(executor);
  registerDeleteTool(executor);
}
