import type { WorkspaceFence } from "@gcah/governance";
import type { ToolGatewayRequest, ToolGatewayResult } from "@gcah/core";

import type { ExecutionContext, Executor } from "./executor.js";
import { ToolRegistry } from "../gateway/tool-registry.js";

export interface LocalExecutorOptions {
  workspaceRoot: string;
  fence: WorkspaceFence;
  outputLimitBytes?: number;
}

export class LocalExecutor implements Executor {
  readonly registry = new ToolRegistry();
  readonly workspaceRoot: string;
  readonly fence: WorkspaceFence;
  readonly outputLimitBytes: number;
  validationRequired = false;

  constructor(options: LocalExecutorOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.fence = options.fence;
    this.outputLimitBytes = options.outputLimitBytes ?? 4096;
  }

  async execute(request: ToolGatewayRequest): Promise<ToolGatewayResult> {
    const definition = this.registry.get(request.tool);
    if (definition === null) return { status: "ERROR", summary: `UNKNOWN_TOOL:${request.tool}` };
    try {
      return await definition.execute(request);
    } catch (error) {
      const code = error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : error instanceof Error
          ? error.name
          : "TOOL_ERROR";
      return { status: "ERROR", summary: code };
    }
  }
}

export function requireAuthorizedContext(context: ExecutionContext | undefined): ToolGatewayResult | null {
  return context?.authorized === true ? null : { status: "ERROR", summary: "GATEWAY_AUTHORIZATION_REQUIRED" };
}
