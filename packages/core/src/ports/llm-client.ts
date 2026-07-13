import type { AgentResponse } from "@gcah/shared";

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LlmClientResult {
  response: AgentResponse;
  usage: LlmUsage | null;
}

export interface LlmClientPort {
  complete(messages: readonly unknown[]): Promise<LlmClientResult>;
}
