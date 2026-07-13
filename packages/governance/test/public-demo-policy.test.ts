import { describe, expect, it } from "vitest";

import { createGovernanceEngine } from "../src/index.js";

describe("public demo policy", () => {
  it("denies commands, network/dependency work, and real workspace mutations", () => {
    const engine = createGovernanceEngine();
    expect(engine.decide({
      kind: "tool",
      tool: "run_command",
      args: { executable: "pnpm", args: ["install"], cwd: ".", timeoutMs: 1000 },
      rationale: "install",
      normalizedSummary: "install"
    }, { mode: "public-demo" })).toMatchObject({
      result: "DENY",
      ruleId: "public-demo.no-shell"
    });

    expect(engine.decide({
      kind: "tool",
      tool: "patch",
      args: { path: "src/app.ts", baseSha256: "a".repeat(64), unifiedDiff: "@@ -1 +1 @@\n-a\n+b" },
      rationale: "edit",
      normalizedSummary: "edit"
    }, { mode: "public-demo" })).toMatchObject({
      result: "DENY",
      ruleId: "public-demo.no-mutations"
    });
  });
});
