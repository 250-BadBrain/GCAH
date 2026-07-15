import type { EventDto, RunEventsResponse } from "@gcah/shared";

type EventSourceLike = {
  onmessage: ((event: MessageEvent<string>) => void) | null;
  close(): void;
};

type EventSourceCtor = new (url: string) => EventSourceLike;

export interface RunEventStreamOptions {
  runId: string;
  initialCursor: number;
  EventSourceCtor?: EventSourceCtor;
  fetchMissed?: (runId: string, cursor: number) => Promise<RunEventsResponse>;
  onEvent(event: EventDto): void;
}

export interface RunEventStream {
  reconnect(): Promise<void>;
  close(): void;
}

export function createRunEventStream(options: RunEventStreamOptions): RunEventStream {
  const EventSourceImpl = options.EventSourceCtor ?? EventSource;
  const fetchMissed = options.fetchMissed ?? defaultFetchMissed;
  let cursor = options.initialCursor;
  let source = connect(cursor);

  function connect(nextCursor: number): EventSourceLike {
    const nextSource = new EventSourceImpl(`/api/runs/${encodeURIComponent(options.runId)}/events/stream?cursor=${nextCursor}`);
    nextSource.onmessage = (message) => {
      const event = JSON.parse(message.data) as EventDto;
      cursor = event.cursor + 1;
      options.onEvent(event);
    };
    return nextSource;
  }

  return {
    async reconnect() {
      source.close();
      const missed = await fetchMissed(options.runId, cursor);
      for (const event of missed.events) {
        cursor = event.cursor + 1;
        options.onEvent(event);
      }
      if (missed.nextCursor !== null) cursor = missed.nextCursor;
      source = connect(cursor);
    },
    close() {
      source.close();
    }
  };
}

async function defaultFetchMissed(runId: string, cursor: number): Promise<RunEventsResponse> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/events?cursor=${cursor}`, {
    credentials: "same-origin"
  });
  if (!response.ok) throw new Error("event replay failed");
  return await response.json() as RunEventsResponse;
}
