import { describe, expect, it } from "vitest";

import {
  DeleteArgsSchema,
  ListArgsSchema,
  MemorySearchArgsSchema,
  PatchArgsSchema,
  ReadArgsSchema,
  RunCommandArgsSchema,
  RunValidationArgsSchema,
  SupportedToolName,
  ToolRequestSchema,
  ToolResultSchema,
  WriteArgsSchema
} from "../src/tool-contracts.js";

describe("tool contracts", () => {
  it("defines the supported tool enum", () => {
    expect(SupportedToolName.options).toEqual([
      "list",
      "read",
      "write",
      "patch",
      "delete",
      "run_command",
      "run_validation",
      "memory_search"
    ]);
  });

  it("parses each registered tool argument schema", () => {
    expect(ListArgsSchema.parse({ path: "." }).path).toBe(".");
    expect(ReadArgsSchema.parse({ path: "README.md" }).path).toBe("README.md");
    expect(WriteArgsSchema.parse({ path: "new.txt", content: "hello" }).content).toBe("hello");
    expect(PatchArgsSchema.parse({
      path: "README.md",
      baseSha256: "a".repeat(64),
      unifiedDiff: "--- a\n+++ b\n"
    }).baseSha256).toHaveLength(64);
    expect(DeleteArgsSchema.parse({ path: "old.txt" }).path).toBe("old.txt");
    expect(RunCommandArgsSchema.parse({
      executable: "pnpm",
      args: ["test"],
      cwd: ".",
      timeoutMs: 1000
    }).args).toEqual(["test"]);
    expect(RunValidationArgsSchema.parse({ kind: "test" }).kind).toBe("test");
    expect(MemorySearchArgsSchema.parse({ query: "policy", tags: ["security"], limit: 3 }).limit).toBe(3);
  });

  it("normalizes tool request and result envelopes", () => {
    expect(ToolRequestSchema.parse({
      id: "request-1",
      runId: "run-1",
      actionId: "action-1",
      tool: "patch",
      args: {
        path: "README.md",
        baseSha256: "b".repeat(64),
        unifiedDiff: "--- a\n+++ b\n"
      }
    }).tool).toBe("patch");

    expect(ToolResultSchema.parse({
      id: "result-1",
      actionId: "action-1",
      status: "OK",
      exitCode: 0,
      toolErrorCode: null,
      stdout: "ok",
      stderr: "",
      durationMs: 1,
      sideEffectSummary: "patched",
      createdAt: "2026-07-13T00:00:00.000Z"
    }).status).toBe("OK");
  });

  it("rejects shell strings and unknown request tools", () => {
    expect(() => RunCommandArgsSchema.parse("pnpm test")).toThrow();
    expect(() => ToolRequestSchema.parse({
      id: "request-1",
      runId: "run-1",
      actionId: "action-1",
      tool: "network_fetch",
      args: {}
    })).toThrow();
  });
});
