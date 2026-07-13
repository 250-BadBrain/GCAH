import { LocalExecutor } from "../executor/local-executor.js";
import { registerListTool } from "./list.js";
import { registerReadTool } from "./read.js";

export function registerReadTools(executor: LocalExecutor): void {
  registerListTool(executor);
  registerReadTool(executor);
}
