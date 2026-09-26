import { describe, expect, it } from "vitest";

import { createGovernanceEngine } from "../src/index.js";
import type { NormalizedAction } from "../src/index.js";

function action(value: NormalizedAction): NormalizedAction {
  return value;
}

function readAction(rationale: string): NormalizedAction {
  return action({
    kind: "tool",
    tool: "read",
    args: { path: "README.md" },
    rationale,
    normalizedSummary: "summary"
  });
}

describe("GovernanceEngine", () => {
  it("classifies safe local actions as ALLOW with stable rule data independent of rationale", () => {
    const engine = createGovernanceEngine();
    for (const candidate of [
      action({ kind: "tool", tool: "list", args: { path: "." }, rationale: "ignored", normalizedSummary: "summary" }),
      readAction("ignored"),
      action({ kind: "tool", tool: "memory_search", args: { query: "policy", tags: [], limit: 5 }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "patch", args: { path: "src/app.ts", baseSha256: "a".repeat(64), unifiedDiff: "@@ -1 +1 @@\n-old\n+new" }, rationale: "ignored", normalizedSummary: "summary" })
    ]) {
      expect(engine.decide(candidate).result).toBe("ALLOW");
    }

    const first = engine.decide(readAction("one"));
    const second = engine.decide(readAction("two"));
    expect(first).toEqual(second);
  });

  it("requires approval for local mutation, dependency, git, config, lock, and network-risk actions", () => {
    const engine = createGovernanceEngine();
    for (const candidate of [
      action({ kind: "tool", tool: "write", args: { path: "src/app.ts", content: "new" }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "delete", args: { path: "src/app.ts" }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "patch", args: { path: "pnpm-lock.yaml", baseSha256: "a".repeat(64), unifiedDiff: "@@ -1 +1 @@\n-a\n+b" }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "patch", args: { path: ".github/workflows/ci.yml", baseSha256: "a".repeat(64), unifiedDiff: "@@ -1 +1 @@\n-a\n+b" }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "run_command", args: { executable: "pnpm", args: ["add", "left-pad"], cwd: ".", timeoutMs: 1000 }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "run_command", args: { executable: "git", args: ["commit", "-m", "x"], cwd: ".", timeoutMs: 1000 }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "run_command", args: { executable: "curl", args: ["https://example.com"], cwd: ".", timeoutMs: 1000 }, rationale: "ignored", normalizedSummary: "summary" })
    ]) {
      expect(engine.decide(candidate).result).toBe("REQUIRE_APPROVAL");
    }
  });

  it("denies path, credential, elevation, and audit violations", () => {
    const engine = createGovernanceEngine();
    for (const candidate of [
      action({ kind: "tool", tool: "read", args: { path: "../secret.txt" }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "read", args: { path: "\\Windows\\System32\\config" }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "read", args: { path: "\\\\server\\share\\secret.txt" }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "read", args: { path: ".env" }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "write", args: { path: ".gcah/audit/log.json", content: "x" }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "write", args: { path: ".gcah/guardrails/policy.json", content: "x" }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "run_command", args: { executable: "sudo", args: ["ls"], cwd: ".", timeoutMs: 1000 }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "run_command", args: { executable: "/usr/bin/sudo", args: ["ls"], cwd: ".", timeoutMs: 1000 }, rationale: "ignored", normalizedSummary: "summary" }),
      action({ kind: "tool", tool: "run_command", args: { executable: "C:\\Windows\\System32\\runas.exe", args: ["ls"], cwd: ".", timeoutMs: 1000 }, rationale: "ignored", normalizedSummary: "summary" })
    ]) {
      expect(engine.decide(candidate).result).toBe("DENY");
    }

  });
});
