import type { LlmClientPort, LlmClientResult, LlmUsage } from "@gcah/core";
import type { CredentialResolver } from "@gcah/credentials";
import { AgentResponseSchema } from "@gcah/shared";

import { OpenAiCompatibleError } from "./provider-errors.js";

export interface OpenAiCompatibleTransportRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: {
    model: string;
    messages: readonly unknown[];
  };
  timeoutMs: number;
}

export interface OpenAiCompatibleTransportResponse {
  status: number;
  body: unknown;
}

export type OpenAiCompatibleTransport = (request: OpenAiCompatibleTransportRequest) => Promise<OpenAiCompatibleTransportResponse>;

export interface OpenAiCompatibleLlmClientOptions {
  baseUrl: string;
  model: string;
  providerName: string;
  credentialResolver: CredentialResolver;
  transport: OpenAiCompatibleTransport;
  timeoutMs?: number;
}

export class OpenAiCompatibleLlmClient implements LlmClientPort {
  constructor(private readonly options: OpenAiCompatibleLlmClientOptions) {}

  async complete(messages: readonly unknown[]): Promise<LlmClientResult> {
    try {
      return await this.options.credentialResolver.withCredential("openai-compatible", async (secret) => {
        const response = await this.options.transport({
          url: `${this.options.baseUrl.replace(/\/+$/u, "")}/chat/completions`,
          method: "POST",
          headers: {
            authorization: `Bearer ${secret}`,
            "content-type": "application/json"
          },
          body: {
            model: this.options.model,
            messages
          },
          timeoutMs: this.options.timeoutMs ?? 30000
        });
        if (response.status === 429) throw new OpenAiCompatibleError("RATE_LIMIT", this.options.providerName);
        if (response.status < 200 || response.status >= 300) throw new OpenAiCompatibleError("HTTP_ERROR", this.options.providerName);
        return parseResponse(response.body, this.options.providerName);
      });
    } catch (error) {
      if (error instanceof OpenAiCompatibleError) throw error;
      throw new OpenAiCompatibleError("NETWORK_ERROR", this.options.providerName);
    }
  }
}

function parseResponse(body: unknown, providerName: string): LlmClientResult {
  if (!isRecord(body)) throw new OpenAiCompatibleError("PROTOCOL_ERROR", providerName);
  const choices = body.choices;
  if (!Array.isArray(choices) || choices.length === 0 || !isRecord(choices[0])) {
    throw new OpenAiCompatibleError("PROTOCOL_ERROR", providerName);
  }
  const message = choices[0].message;
  if (!isRecord(message) || typeof message.content !== "string") {
    throw new OpenAiCompatibleError("PROTOCOL_ERROR", providerName);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(message.content);
  } catch {
    throw new OpenAiCompatibleError("PROTOCOL_ERROR", providerName);
  }
  const agentResponse = AgentResponseSchema.safeParse(parsed);
  if (!agentResponse.success) throw new OpenAiCompatibleError("PROTOCOL_ERROR", providerName);
  return {
    response: agentResponse.data,
    usage: parseUsage(body.usage)
  };
}

function parseUsage(value: unknown): LlmUsage | null {
  if (!isRecord(value)) return null;
  const inputTokens = value.prompt_tokens;
  const outputTokens = value.completion_tokens;
  const totalTokens = value.total_tokens;
  if (typeof inputTokens !== "number" || typeof outputTokens !== "number" || typeof totalTokens !== "number") {
    return null;
  }
  return { inputTokens, outputTokens, totalTokens };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
