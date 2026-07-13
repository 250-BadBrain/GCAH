import type { ToolGatewayRequest, ToolGatewayResult } from "@gcah/core";

export type ExecutionRequest = ToolGatewayRequest;

export interface ExecutionContext {
  authorized: boolean;
}

export interface Executor {
  execute(request: ExecutionRequest, context?: ExecutionContext): Promise<ToolGatewayResult>;
}
