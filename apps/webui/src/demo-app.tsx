import { useEffect, useState } from "react";
import type { EventDto, RunDto, RunEventsResponse } from "@gcah/shared";

interface DemoExample {
  id: string;
  title: string;
  marker: string;
}

interface CreatedRun extends RunDto {
  runId?: string;
}

interface DemoFiles {
  workspace: string;
  before: Record<string, string>;
  after: Record<string, string>;
}

export function DemoApp(): React.JSX.Element {
  const [examples, setExamples] = useState<DemoExample[]>([]);
  const [run, setRun] = useState<RunDto | null>(null);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [files, setFiles] = useState<DemoFiles | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/public-demo/examples")
      .then(async (response) => await response.json() as { examples: DemoExample[] })
      .then((body) => setExamples(body.examples))
      .catch(() => setError("Could not load demo scenarios."));
  }, []);

  async function start(exampleId: string): Promise<void> {
    setError(null);
    setEvents([]);
    setFiles(null);
    const response = await fetch("/api/public-demo/runs", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ exampleId })
    });
    if (!response.ok) {
      setError("Scenario could not be started.");
      return;
    }
    const created = await response.json() as CreatedRun;
    const runId = created.runId ?? created.id;
    setRun({ ...created, id: runId });
    await refreshRun(runId);
    connectStream(runId, 0);
  }

  async function approve(): Promise<void> {
    if (run === null) return;
    const response = await fetch(`/api/runs/${encodeURIComponent(run.id)}/approvals/demo-finish`, {
      method: "POST",
      credentials: "same-origin"
    });
    if (!response.ok) {
      setError("Approval could not be recorded.");
      return;
    }
    const updated = await response.json() as RunDto;
    setRun(updated);
    await refreshRun(updated.id);
  }

  async function refreshRun(runId: string): Promise<void> {
    const runResponse = await fetch(`/api/runs/${encodeURIComponent(runId)}`, { credentials: "same-origin" });
    if (runResponse.ok) setRun(await runResponse.json() as RunDto);
    const filesResponse = await fetch(`/api/runs/${encodeURIComponent(runId)}/files`, { credentials: "same-origin" });
    if (filesResponse.ok) setFiles(await filesResponse.json() as DemoFiles);
    const eventResponse = await fetch(`/api/runs/${encodeURIComponent(runId)}/events?cursor=0`, {
      credentials: "same-origin"
    });
    const body = await eventResponse.json() as RunEventsResponse;
    setEvents(body.events);
  }

  function connectStream(runId: string, cursor: number): void {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events/stream?cursor=${cursor}`);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as EventDto;
      setEvents((current) => current.some((item) => item.id === event.id) ? current : [...current, event]);
    };
    source.onerror = () => source.close();
  }

  return (
    <main className="app-shell demo-shell">
      <section aria-labelledby="demo-heading" className="run-list">
        <h1 id="demo-heading">GCAH Final Demo</h1>
        <p>Mock LLM only. No API key, shell, upload, arbitrary workspace, or external service is required.</p>
        <ul>
          {examples.map((example) => (
            <li key={example.id}>
              <button type="button" className="run-list-item" onClick={() => void start(example.id)}>
                <span>{example.title}</span>
                <small>{example.marker}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="run-heading" className="run-detail">
        <h2 id="run-heading">Run</h2>
        {error === null ? null : <p role="alert">{error}</p>}
        {run === null ? (
          <p>Select a scenario to start a deterministic Mock LLM run.</p>
        ) : (
          <>
            <p>Run status: {run.status}</p>
            <p>StopReason: {run.stopReason ?? "none"}</p>
            <p>Task: {run.taskSummary}</p>
            {run.status === "WAITING_APPROVAL" ? (
              <button type="button" onClick={() => void approve()}>Approve and continue</button>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="files-heading">
        <h2 id="files-heading">Demo Workspace Files</h2>
        {files === null ? (
          <p>No files loaded.</p>
        ) : (
          Object.keys(files.before).map((path) => (
            <article key={path}>
              <h3>{path}</h3>
              <div className="file-grid">
                <pre aria-label={`${path} before`}>{files.before[path]}</pre>
                <pre aria-label={`${path} after`}>{files.after[path]}</pre>
              </div>
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="events-heading">
        <h2 id="events-heading">RunEvent Stream</h2>
        <ol aria-label="Run events">
          {events.map((event) => (
            <li key={event.id}>
              <span>{event.cursor} </span>
              <strong>{event.type}</strong>
              <span> {event.summary}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
