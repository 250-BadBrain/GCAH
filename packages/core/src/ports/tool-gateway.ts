import type { SupportedToolName } from "@gcah/shared";

export interface ToolGatewayRequest {
  tool: SupportedToolName;
  args: unknown;
}

export interface ToolGatewayResult {
  status: "OK" | "ERROR";
  summary: string;
}

export interface ToolGatewayPort {
  execute(request: ToolGatewayRequest): Promise<ToolGatewayResult>;
}
