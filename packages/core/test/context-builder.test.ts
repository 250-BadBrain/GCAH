import { describe, expect, it } from "vitest";

import { buildLoopContext } from "../src/index.js";
import type { ConfigSnapshot } from "@gcah/shared";

const configSnapshot: ConfigSnapshot = {
  id: "config-1",
  schemaVersion: 1,
  allowedWorkspaceRoots: ["E:/workspace"],
  nonSensitiveConfig: {
    mode: "local",
    validation: { required: ["test"] },
    commands: { test: "pnpm test" }
  },
  contentHash: "hash",
  createdAt: "2026-01-01T00:00:00.000Z"
};

describe("buildLoopContext", () => {
  it("builds bounded context from task, config, memory, feedback, and budgets", () => {
    const context = buildLoopContext({
      taskSummary: "Fix the test",
      configSnapshot,
      memories: [
        { text: "Use pnpm and keep patches small", sourceType: "project_constraint", grantsAuthority: false },
        { text: "Previous approval is context only", sourceType: "approval_decision", grantsAuthority: false }
      ],
      feedback: [{ sourceId: "validation-1", category: "test_assertion", summary: "Validation failed: test_assertion" }],
      budget: { rounds: 2, tokens: 40, elapsedMs: 1000, repeatedFailures: 0, usageUnavailable: false },
      maxChars: 260
    });

    expect(context.messages).toHaveLength(1);
    expect(String(context.messages[0])).toContain("Fix the test");
    expect(String(context.messages[0])).toContain("Validation failed");
    expect(String(context.messages[0])).toContain("grantsAuthority=false");
    expect(context.summary.length).toBeLessThanOrEqual(260);
  });
});
