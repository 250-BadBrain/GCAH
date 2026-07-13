import { describe, expect, it } from "vitest";

import { MockLlmClient, MockLlmScriptExhaustedError } from "../src/index.js";
import type { LlmClientPort } from "@gcah/core";

describe("MockLlmClient", () => {
  it("implements LlmClientPort with deterministic scripts and request capture", async () => {
    const client: LlmClientPort & MockLlmClient = new MockLlmClient([
      { response: { kind: "tool", tool: "read", args: { path: "README.md" }, rationale: "inspect" }, usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } },
      { response: { kind: "finish", summary: "done", rationale: "complete" }, usage: null }
    ]);

    await expect(client.complete([{ role: "user", content: "first" }])).resolves.toMatchObject({
      response: { kind: "tool", tool: "read" },
      usage: { totalTokens: 5 }
    });
    await expect(client.complete([{ role: "user", content: "second" }])).resolves.toMatchObject({
      response: { kind: "finish", summary: "done" },
      usage: null
    });

    expect(client.requests).toEqual([
      [{ role: "user", content: "first" }],
      [{ role: "user", content: "second" }]
    ]);
    await expect(client.complete([])).rejects.toBeInstanceOf(MockLlmScriptExhaustedError);
  });
});
