import { describe, expect, it } from "vitest";

import { createServerApp } from "../src/index.js";
import { createInMemoryRepositories } from "@gcah/persistence";
import type { Clock } from "@gcah/core";

const timestamp = "2026-07-13T00:00:00.000Z";

class FakeClock implements Clock {
  now(): Date {
    return new Date(timestamp);
  }

  nowIso(): string {
    return timestamp;
  }
}

describe("server events", () => {
  it("replays committed events from cursor as JSON and SSE", async () => {
    const unitOfWork = createInMemoryRepositories(new FakeClock());
    const app = createServerApp({ unitOfWork, clock: new FakeClock(), auth: { enabled: false } });
    await unitOfWork.repositories.events.append({
      id: "event-1",
      runId: "run-1",
      stepId: null,
      type: "run.started",
      relatedEntityId: "run-1",
      summary: "started",
      createdAt: timestamp
    });
    await unitOfWork.repositories.events.append({
      id: "event-2",
      runId: "run-1",
      stepId: null,
      type: "run.completed",
      relatedEntityId: "run-1",
      summary: "done",
      createdAt: timestamp
    });

    const json = await app.inject({ method: "GET", url: "/api/runs/run-1/events?cursor=1" });
    expect(json.json()).toEqual({
      events: [expect.objectContaining({ id: "event-2", cursor: 2 })],
      nextCursor: 2
    });

    const sse = await app.inject({ method: "GET", url: "/api/runs/run-1/events/stream", headers: { "last-event-id": "1" } });
    expect(sse.headers["content-type"]).toContain("text/event-stream");
    expect(sse.payload).toContain("id: 2");
    expect(sse.payload).toContain("event: run.completed");
  });
});
