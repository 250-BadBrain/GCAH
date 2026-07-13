import { describe, expect, it } from "vitest";

import {
  AgentResponseSchema,
  FinishActionSchema,
  ToolActionSchema
} from "../src/agent-response.js";

describe("agent response schema", () => {
  it("parses exactly one structured tool or finish action", () => {
    expect(ToolActionSchema.parse({
      kind: "tool",
      tool: "read",
      args: { path: "README.md" },
      rationale: "inspect the file"
    }).tool).toBe("read");

    expect(FinishActionSchema.parse({
      kind: "finish",
      summary: "done",
      rationale: "all checks pass"
    }).summary).toBe("done");
  });

  it("rejects free-form, multi-action, malformed, and unknown-tool responses", () => {
    expect(() => AgentResponseSchema.parse("please run tests")).toThrow();
    expect(() => AgentResponseSchema.parse([
      { kind: "tool", tool: "read", args: {}, rationale: "first" },
      { kind: "finish", summary: "done", rationale: "second" }
    ])).toThrow();
    expect(() => AgentResponseSchema.parse({
      kind: "tool",
      tool: "network_fetch",
      args: {},
      rationale: "not registered"
    })).toThrow();
    expect(() => AgentResponseSchema.parse({
      kind: "finish",
      summary: "done",
      rationale: "ok",
      extra: true
    })).toThrow();
    expect(() => AgentResponseSchema.parse({
      kind: "tool",
      tool: "patch",
      args: {},
      rationale: "missing patch args"
    })).toThrow();
  });
});
