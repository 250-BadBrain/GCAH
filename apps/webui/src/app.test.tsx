// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./app.js";
import type { RunDto, RunEventsResponse } from "@gcah/shared";

const run: RunDto = {
  id: "run-1",
  status: "WAITING_APPROVAL",
  taskSummary: "Implement a guarded patch",
  stopReason: null,
  createdAt: "2026-07-14T10:00:00.000Z",
  updatedAt: "2026-07-14T10:01:00.000Z"
};

const events: RunEventsResponse = {
  nextCursor: 4,
  events: [
    {
      id: "event-1",
      type: "validation",
      summary: "typecheck failed: missing import",
      cursor: 1,
      createdAt: "2026-07-14T10:00:30.000Z"
    },
    {
      id: "event-2",
      type: "approval_required",
      summary: "<script>alert('x')</script> requires human approval",
      cursor: 2,
      createdAt: "2026-07-14T10:00:40.000Z"
    },
    {
      id: "event-3",
      type: "paused",
      summary: "Paused until approval is recorded",
      cursor: 3,
      createdAt: "2026-07-14T10:00:50.000Z"
    }
  ]
};

describe("App observation views", () => {
  it("renders run status, ordered timeline, validation details, and pause guidance", () => {
    render(<App runs={[run]} selectedRunId="run-1" events={events} />);

    expect(screen.getByRole("heading", { name: "Runs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run-1 WAITING_APPROVAL/i })).toBeInTheDocument();
    const status = screen.getByRole("region", { name: "Status" });
    expect(within(status).getByText("Implement a guarded patch")).toBeInTheDocument();
    expect(within(status).getByText("Next action: review and decide pending approvals.")).toBeInTheDocument();

    const timeline = screen.getByLabelText("Run timeline");
    const items = within(timeline).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("1 validation typecheck failed: missing import"),
      expect.stringContaining("2 approval_required <script>alert('x')</script> requires human approval"),
      expect.stringContaining("3 paused Paused until approval is recorded")
    ]);
    expect(timeline.querySelector("script")).toBeNull();
    expect(screen.getByText("Validation: typecheck failed: missing import")).toBeInTheDocument();
  });
});
