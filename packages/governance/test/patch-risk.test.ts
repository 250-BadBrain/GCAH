import { describe, expect, it } from "vitest";

import { assessPatchRisk } from "../src/index.js";

describe("assessPatchRisk", () => {
  it("allows small ordinary patches and escalates broad or sensitive patches", () => {
    expect(assessPatchRisk({
      path: "src/app.ts",
      unifiedDiff: "@@ -1 +1 @@\n-old\n+new"
    })).toMatchObject({ riskCategory: "low", requiresApproval: false });

    expect(assessPatchRisk({
      path: "pnpm-lock.yaml",
      unifiedDiff: "@@ -1 +1 @@\n-a\n+b"
    })).toMatchObject({ riskCategory: "lockfile", requiresApproval: true });

    expect(assessPatchRisk({
      path: "src/app.ts",
      unifiedDiff: `${"@@ -1 +1 @@\n-old\n+new\n".repeat(101)}`
    })).toMatchObject({ riskCategory: "large_patch", requiresApproval: true });
  });
});
