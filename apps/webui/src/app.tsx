import type { RunDto, RunEventsResponse } from "@gcah/shared";

export interface AppProps {
  runs: readonly RunDto[];
  selectedRunId: string | null;
  events: RunEventsResponse;
}

export function App({ runs, selectedRunId, events }: AppProps): React.JSX.Element {
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;
  const sortedEvents = [...events.events].sort((left, right) => left.cursor - right.cursor);
  const validationEvent = sortedEvents.find((event) => event.type === "validation");
  const nextAction = selectedRun?.status === "WAITING_APPROVAL"
    ? "Next action: review and decide pending approvals."
    : "Next action: observe the run timeline.";

  return (
    <main className="app-shell">
      <section aria-labelledby="runs-heading" className="run-list">
        <h1 id="runs-heading">Runs</h1>
        <ul>
          {runs.map((run) => (
            <li key={run.id}>
              <button type="button" className="run-list-item">
                <span>{run.id} {run.status}</span>
                <small>{run.taskSummary}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="status-heading" className="run-detail">
        <h2 id="status-heading">Status</h2>
        {selectedRun === null ? (
          <p>No run selected.</p>
        ) : (
          <>
            <p>{selectedRun.taskSummary}</p>
            <p>{nextAction}</p>
          </>
        )}
      </section>

      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">Timeline</h2>
        <ol aria-label="Run timeline">
          {sortedEvents.map((event) => (
            <li key={event.id}>
              <span>{event.cursor} </span>
              <strong>{event.type}</strong>
              <span> {event.summary}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="validation-heading">
        <h2 id="validation-heading">Validation</h2>
        <p>{validationEvent === undefined ? "Validation: no validation event yet" : `Validation: ${validationEvent.summary}`}</p>
      </section>
    </main>
  );
}
