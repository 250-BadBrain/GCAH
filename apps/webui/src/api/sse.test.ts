import { describe, expect, it, vi } from "vitest";

import { createRunEventStream } from "./sse.js";
import type { RunEventsResponse } from "@gcah/shared";

class FakeEventSource extends EventTarget {
  static urls: string[] = [];

  readonly url: string;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.urls.push(url);
  }

  close(): void {}

  emit(data: string): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }
}

describe("run event SSE client", () => {
  it("connects with the last cursor and replays missed events after reconnect", async () => {
    const responses: RunEventsResponse[] = [
      { events: [{ id: "event-2", type: "validation", summary: "missed", cursor: 2, createdAt: "2026-07-14T10:00:00.000Z" }], nextCursor: 3 }
    ];
    const fetchMissed = vi.fn(async () => responses.shift() ?? { events: [], nextCursor: null });
    const received: string[] = [];
    const stream = createRunEventStream({
      runId: "run-1",
      initialCursor: 1,
      EventSourceCtor: FakeEventSource,
      fetchMissed,
      onEvent: (event) => received.push(`${event.cursor}:${event.summary}`)
    });

    expect(FakeEventSource.urls).toEqual(["/api/runs/run-1/events/stream?cursor=1"]);
    await stream.reconnect();

    expect(fetchMissed).toHaveBeenCalledWith("run-1", 1);
    expect(FakeEventSource.urls).toEqual([
      "/api/runs/run-1/events/stream?cursor=1",
      "/api/runs/run-1/events/stream?cursor=3"
    ]);
    expect(received).toEqual(["2:missed"]);
  });
});
