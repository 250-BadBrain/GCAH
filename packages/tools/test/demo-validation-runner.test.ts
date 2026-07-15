import { describe, expect, it } from "vitest";

import { DemoValidationRunner } from "../src/validation/demo-validation-runner.js";
import type { ConfigSnapshot } from "@gcah/shared";

const config: ConfigSnapshot = {
  id: "config-demo",
  schemaVersion: 1,
  allowedWorkspaceRoots: ["demo"],
  nonSensitiveConfig: {},
  contentHash: "hash",
  createdAt: "2026-07-14T10:00:00.000Z"
};

describe("DemoValidationRunner", () => {
  it("returns deterministic preset validation results without running commands", async () => {
    const runner = new DemoValidationRunner({
      test: { result: "FAIL", diagnosticSummary: "expected demo failure" }
    });

    await expect(runner.runValidator("test", config)).resolves.toMatchObject({
      type: "test",
      result: "FAIL",
      diagnosticSummary: "expected demo failure"
    });
  });
});
