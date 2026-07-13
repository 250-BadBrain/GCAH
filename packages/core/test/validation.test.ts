import { describe, expect, it } from "vitest";

import { FeedbackQueue, ValidationService } from "../src/index.js";
import type { ValidationRunner } from "../src/index.js";
import type { ToolRequest, ValidationResult } from "@gcah/shared";

const failedResult: ValidationResult = {
  id: "validation-1",
  actionId: "action-1",
  type: "test",
  commandSnapshot: "pnpm test",
  result: "FAIL",
  failureCategory: null,
  failureFingerprint: null,
  diagnosticSummary: "AssertionError at 2026-07-13T00:00:00.000Z E:/Desktop/GCAH/src/app.ts:10",
  durationMs: 10,
  createdAt: "2026-07-13T00:00:00.000Z"
};

class FakeRunner implements ValidationRunner {
  calls = 0;
  constructor(private readonly results: ValidationResult[]) {}
  async runRequired(): Promise<ValidationResult[]> {
    this.calls += 1;
    return this.results;
  }
}

function request(tool: ToolRequest["tool"]): ToolRequest {
  const args = tool === "read"
    ? { path: "README.md" }
    : tool === "memory_search"
      ? { query: "policy", tags: [], limit: 5 }
      : { path: "src/app.ts", content: "new" };
  return { id: "req-1", runId: "run-1", actionId: "action-1", tool, args } as ToolRequest;
}

describe("ValidationService", () => {
  it("runs validators for mutations and skips read-only tools", async () => {
    const runner = new FakeRunner([failedResult]);
    const service = new ValidationService(runner);

    await expect(service.validate(request("read"))).resolves.toMatchObject({ required: false, readyToComplete: true });
    await expect(service.validate(request("memory_search"))).resolves.toMatchObject({ required: false, readyToComplete: true });
    expect(runner.calls).toBe(0);

    await expect(service.validate(request("write"))).resolves.toMatchObject({
      required: true,
      readyToComplete: false,
      results: [{ failureCategory: "test_assertion" }]
    });
    expect(runner.calls).toBe(1);
  });

  it("queues objective feedback once", () => {
    const queue = new FeedbackQueue();
    queue.enqueueValidation(failedResult);
    queue.enqueueValidation(failedResult);
    expect(queue.consumeOnce()).toEqual([
      {
        category: "test_assertion",
        summary: "Validation failed: test_assertion",
        sourceId: "validation-1"
      }
    ]);
    expect(queue.consumeOnce()).toEqual([]);
  });
});
