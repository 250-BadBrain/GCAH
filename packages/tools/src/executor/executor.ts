import type { ToolGatewayRequest, ToolGatewayResult } from "@gcah/core";

export type ExecutionRequest = ToolGatewayRequest;

export interface Executor {
  execute(request: ExecutionRequest): Promise<ToolGatewayResult>;
}
