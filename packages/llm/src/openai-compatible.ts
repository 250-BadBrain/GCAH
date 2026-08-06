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
    messages: readonly OpenAiCompatibleMessage[];
    response_format: { type: "json_object" };
    temperature: number;
  };
  timeoutMs: number;
}

export interface OpenAiCompatibleTransportResponse {
  status: number;
  body: unknown;
}

export type OpenAiCompatibleTransport = (request: OpenAiCompatibleTransportRequest) => Promise<OpenAiCompatibleTransportResponse>;

export interface OpenAiCompatibleMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAiCompatibleLlmClientOptions {
  baseUrl: string;
  model: string;
  providerName: string;
  credentialResolver: CredentialResolver;
  transport?: OpenAiCompatibleTransport;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class OpenAiCompatibleLlmClient implements LlmClientPort {
  constructor(private readonly options: OpenAiCompatibleLlmClientOptions) {}

  async complete(messages: readonly unknown[]): Promise<LlmClientResult> {
    try {
      return await this.options.credentialResolver.withCredential("openai-compatible", async (secret) => {
        const transport = this.options.transport ?? createOpenAiCompatibleFetchTransport();
        const response = await requestWithRetry(transport, {
          url: `${this.options.baseUrl.replace(/\/+$/u, "")}/chat/completions`,
          method: "POST",
          headers: {
            authorization: `Bearer ${secret}`,
            "content-type": "application/json"
          },
          body: {
            model: this.options.model,
            messages: normalizeMessages(messages),
            response_format: { type: "json_object" },
            temperature: 0
          },
          timeoutMs: this.options.timeoutMs ?? 30000
        }, this.options.retryAttempts ?? 3, this.options.retryDelayMs ?? 250);
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

async function requestWithRetry(
  transport: OpenAiCompatibleTransport,
  request: OpenAiCompatibleTransportRequest,
  retryAttempts: number,
  retryDelayMs: number
): Promise<OpenAiCompatibleTransportResponse> {
  const attempts = Math.max(1, retryAttempts);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await transport(request);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(retryDelayMs * attempt);
    }
  }
  throw lastError;
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function createOpenAiCompatibleFetchTransport(fetchFn: typeof fetch = fetch): OpenAiCompatibleTransport {
  return async (request) => {
    const response = await fetchFn(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(request.timeoutMs)
    });
    return {
      status: response.status,
      body: await response.json()
    };
  };
}

const SYSTEM_PROMPT = [
  "You are the GCAH Coding Agent Harness action planner.",
  "Return only valid JSON. Do not wrap it in markdown. Do not include prose.",
  "Use the latest Feedback section to choose the next action. Do not repeat the same read action after its content is already shown.",
  "For coding tasks, once you have read the requirements and the target source file, propose a patch or write action next instead of reading again.",
  "For a simple file replacement, prefer write with the full desired file content.",
  "Allowed responses are:",
  "{\"kind\":\"tool\",\"tool\":\"list\",\"args\":{\"path\":\".\"},\"rationale\":\"...\"}",
  "{\"kind\":\"tool\",\"tool\":\"read\",\"args\":{\"path\":\"README.md\"},\"rationale\":\"...\"}",
  "{\"kind\":\"tool\",\"tool\":\"write\",\"args\":{\"path\":\"src/app.ts\",\"content\":\"...\"},\"rationale\":\"...\"}",
  "{\"kind\":\"tool\",\"tool\":\"patch\",\"args\":{\"path\":\"src/app.ts\",\"baseSha256\":\"0000000000000000000000000000000000000000000000000000000000000000\",\"unifiedDiff\":\"--- a/src/app.ts\\n+++ b/src/app.ts\\n@@\\n-old\\n+new\\n\"},\"rationale\":\"...\"}",
  "{\"kind\":\"tool\",\"tool\":\"run_validation\",\"args\":{\"kind\":\"test\"},\"rationale\":\"...\"}",
  "{\"kind\":\"finish\",\"summary\":\"...\",\"rationale\":\"...\"}"
].join("\n");

function normalizeMessages(messages: readonly unknown[]): readonly OpenAiCompatibleMessage[] {
  if (messages.every(isOpenAiCompatibleMessage)) return messages;
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((message) => ({ role: "user" as const, content: typeof message === "string" ? message : JSON.stringify(message) }))
  ];
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
  const parsed = parseJsonObject(message.content);
  if (parsed === null) {
    throw new OpenAiCompatibleError("PROTOCOL_ERROR", providerName);
  }
  const agentResponse = AgentResponseSchema.safeParse(parsed);
  if (!agentResponse.success) throw new OpenAiCompatibleError("PROTOCOL_ERROR", providerName);
  return {
    response: agentResponse.data,
    usage: parseUsage(body.usage)
  };
}

function parseJsonObject(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    const extracted = extractFirstJsonObject(content);
    if (extracted === null) return null;
    try {
      return JSON.parse(extracted);
    } catch {
      return null;
    }
  }
}

function extractFirstJsonObject(content: string): string | null {
  const start = content.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return content.slice(start, index + 1);
    }
  }
  return null;
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

function isOpenAiCompatibleMessage(value: unknown): value is OpenAiCompatibleMessage {
  if (!isRecord(value)) return false;
  return (value.role === "system" || value.role === "user" || value.role === "assistant") && typeof value.content === "string";
}
