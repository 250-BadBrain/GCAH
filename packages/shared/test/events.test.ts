import { describe, expect, it } from "vitest";

import { RunEventCursorSchema, RunEventSchema } from "../src/events.js";

describe("event contracts", () => {
  it("parses run events with monotonic cursors", () => {
    expect(RunEventSchema.parse({
      id: "event-1",
      runId: "run-1",
      stepId: null,
      type: "run.started",
      relatedEntityId: "run-1",
      summary: "started",
      cursor: 1,
      createdAt: "2026-07-13T00:00:00.000Z"
    }).cursor).toBe(1);

    expect(RunEventCursorSchema.parse("42")).toBe(42);
    expect(() => RunEventCursorSchema.parse("0")).toThrow();
  });
});
