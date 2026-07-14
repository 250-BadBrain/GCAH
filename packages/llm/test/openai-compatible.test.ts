import { describe, expect, it, vi } from "vitest";

import {
  OpenAiCompatibleError,
  OpenAiCompatibleLlmClient,
  type OpenAiCompatibleTransport
} from "../src/index.js";
import type { CredentialResolver } from "@gcah/credentials";

function resolver(secret: string): CredentialResolver {
  return {
    async withCredential(_provider, callback) {
      return callback(secret);
    }
  };
}

describe("OpenAiCompatibleLlmClient", () => {
  it("sends one Chat Completions request with bearer key only in headers", async () => {
    const requests: Parameters<OpenAiCompatibleTransport>[0][] = [];
    const transport: OpenAiCompatibleTransport = async (request) => {
      requests.push(request);
      return {
        status: 200,
        body: {
          choices: [{ message: { content: JSON.stringify({ kind: "finish", summary: "done", rationale: "complete" }) } }],
          usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 }
        }
      };
    };
    const client = new OpenAiCompatibleLlmClient({
      baseUrl: "https://course-gateway.example/v1",
      model: "deepseek-course",
      providerName: "course",
      credentialResolver: resolver("sk-test-secret"),
      transport
    });

    await expect(client.complete([{ role: "user", content: "hello" }])).resolves.toEqual({
      response: { kind: "finish", summary: "done", rationale: "complete" },
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
    });
    expect(requests).toEqual([{
      url: "https://course-gateway.example/v1/chat/completions",
      method: "POST",
      headers: {
        authorization: "Bearer sk-test-secret",
        "content-type": "application/json"
      },
      body: {
        model: "deepseek-course",
        messages: [{ role: "user", content: "hello" }]
      },
      timeoutMs: 30000
    }]);
    expect(JSON.stringify(requests[0]?.body)).not.toContain("sk-test-secret");
  });

  it("provides a default fetch-backed transport", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ kind: "finish", summary: "done", rationale: "complete" }) } }]
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const client = new OpenAiCompatibleLlmClient({
      baseUrl: "https://course-gateway.example/v1/",
      model: "deepseek-course",
      providerName: "course",
      credentialResolver: resolver("sk-test-secret")
    });

    try {
      await expect(client.complete([{ role: "user", content: "hello" }])).resolves.toMatchObject({
        response: { kind: "finish", summary: "done", rationale: "complete" }
      });
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] ?? [];
      expect(url).toBe("https://course-gateway.example/v1/chat/completions");
      expect(init).toMatchObject({
        method: "POST",
        headers: {
          authorization: "Bearer sk-test-secret",
          "content-type": "application/json"
        }
      });
      expect(String(init?.body)).not.toContain("sk-test-secret");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preserves missing usage as unavailable and maps provider errors without leaking the key", async () => {
    const client = new OpenAiCompatibleLlmClient({
      baseUrl: "https://gateway.example",
      model: "qwen-course",
      providerName: "qwen",
      credentialResolver: resolver("sk-test-secret"),
      transport: async () => ({
        status: 429,
        body: { error: { message: "rate limit for sk-test-secret" } }
      })
    });

    await expect(client.complete([])).rejects.toMatchObject({
      name: "OpenAiCompatibleError",
      code: "RATE_LIMIT",
      providerName: "qwen"
    });
    await expect(client.complete([])).rejects.not.toThrow("sk-test-secret");
  });

  it("returns null usage when the provider omits token accounting", async () => {
    const client = new OpenAiCompatibleLlmClient({
      baseUrl: "https://gateway.example/",
      model: "neutral-model",
      providerName: "course",
      credentialResolver: resolver("sk-test-secret"),
      transport: async () => ({
        status: 200,
        body: {
          choices: [{ message: { content: JSON.stringify({ kind: "finish", summary: "done", rationale: "complete" }) } }]
        }
      })
    });

    await expect(client.complete([])).resolves.toMatchObject({ usage: null });
  });

  it("stabilizes network and malformed response failures", async () => {
    const network = new OpenAiCompatibleLlmClient({
      baseUrl: "https://gateway.example",
      model: "model",
      providerName: "course",
      credentialResolver: resolver("sk-test-secret"),
      transport: async () => {
        throw new Error("network contains sk-test-secret");
      }
    });
    await expect(network.complete([])).rejects.toBeInstanceOf(OpenAiCompatibleError);
    await expect(network.complete([])).rejects.not.toThrow("sk-test-secret");

    const malformed = new OpenAiCompatibleLlmClient({
      baseUrl: "https://gateway.example",
      model: "model",
      providerName: "course",
      credentialResolver: resolver("sk-test-secret"),
      transport: async () => ({ status: 200, body: { choices: [{ message: { content: "not json" } }] } })
    });
    await expect(malformed.complete([])).rejects.toMatchObject({ code: "PROTOCOL_ERROR" });
  });
});
