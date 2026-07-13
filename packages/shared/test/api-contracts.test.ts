import { describe, expect, it } from "vitest";

import {
  ApprovalDecisionRequestSchema,
  CreateRunRequestSchema,
  RunDtoSchema,
  RunEventsResponseSchema
} from "../src/api-contracts.js";

describe("api contracts", () => {
  it("parses core HTTP DTOs without secrets", () => {
    expect(CreateRunRequestSchema.parse({
      workspacePath: "E:/Desktop/example",
      task: "fix tests"
    }).task).toBe("fix tests");

    expect(ApprovalDecisionRequestSchema.parse({
      decision: "approve_once",
      reason: "looks safe"
    }).decision).toBe("approve_once");

    expect(RunDtoSchema.parse({
      id: "run-1",
      status: "PENDING",
      taskSummary: "fix tests",
      stopReason: null,
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z"
    }).status).toBe("PENDING");

    expect(RunEventsResponseSchema.parse({
      events: [],
      nextCursor: null
    }).events).toEqual([]);
  });

  it("rejects API-key shaped fields in DTOs", () => {
    expect(() => CreateRunRequestSchema.parse({
      workspacePath: "E:/Desktop/example",
      task: "fix tests",
      apiKey: "sk-test-secret"
    })).toThrow();
  });
});
