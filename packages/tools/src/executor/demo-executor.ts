import type { ToolGatewayRequest, ToolGatewayResult } from "@gcah/core";
import type { Executor, ExecutionContext } from "./executor.js";

export type DemoExecutorPreset = Record<string, ToolGatewayResult>;

export class DemoExecutor implements Executor {
  constructor(private readonly presets: DemoExecutorPreset = {}) {}

  async execute(request: ToolGatewayRequest, context?: ExecutionContext): Promise<ToolGatewayResult> {
    void context;
    if (request.tool === "run_command" || request.tool === "run_validation" || request.tool === "memory_search") {
      return denied();
    }
    const result = this.presets[presetKey(request)] ?? null;
    return result ?? denied();
  }
}

function presetKey(request: ToolGatewayRequest): string {
  return `${request.tool}:${JSON.stringify(request.args)}`;
}

function denied(): ToolGatewayResult {
  return { status: "ERROR", summary: "public demo capability denied" };
}
