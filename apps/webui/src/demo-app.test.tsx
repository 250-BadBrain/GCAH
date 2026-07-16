// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DemoApp } from "./demo-app.js";

describe("DemoApp", () => {
  it("loads scenarios, starts a public demo run, and renders REST/SSE events", async () => {
    const events = [
      { id: "event-1", type: "governance.decision", summary: "GovernanceDecision DENY DANGEROUS_ACTION_DENIED", cursor: 1, createdAt: "2026-07-14T00:00:00.000Z" },
      { id: "event-2", type: "validation.result", summary: "ValidationResult SKIPPED", cursor: 2, createdAt: "2026-07-14T00:00:00.000Z" }
    ];
    const fetchSpy = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === "/api/public-demo/examples") {
        return json({ examples: [{ id: "dangerous-denied", title: "Dangerous action denied", marker: "DANGEROUS_ACTION_DENIED" }] });
      }
      if (url === "/api/public-demo/runs") {
        return json({ id: "run-1", runId: "run-1", status: "WAITING_APPROVAL", taskSummary: "Dangerous action denied", stopReason: null, createdAt: "2026-07-14T00:00:00.000Z", updatedAt: "2026-07-14T00:00:00.000Z" }, 201);
      }
      if (url === "/api/runs/run-1") return json({ id: "run-1", status: "WAITING_APPROVAL", taskSummary: "Dangerous action denied", stopReason: null, createdAt: "2026-07-14T00:00:00.000Z", updatedAt: "2026-07-14T00:00:00.000Z" });
      if (url === "/api/runs/run-1/files") return json({ workspace: "isolated-demo-workspace", before: { "src/app.ts": "broken" }, after: { "src/app.ts": "fixed" } });
      if (url === "/api/runs/run-1/events?cursor=0") return json({ events, nextCursor: 2 });
      if (url === "/api/runs/run-1/approvals/demo-finish") return json({ id: "run-1", status: "COMPLETED", taskSummary: "Dangerous action denied", stopReason: "COMPLETED", createdAt: "2026-07-14T00:00:00.000Z", updatedAt: "2026-07-14T00:00:01.000Z" });
      return json({ error: "unexpected" }, 404);
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      render(<DemoApp />);
      await screen.findByRole("button", { name: /Dangerous action denied/i });
      await userEvent.click(screen.getByRole("button", { name: /Dangerous action denied/i }));

      expect(await screen.findByText(/Run status: WAITING_APPROVAL/i)).toBeInTheDocument();
      expect(screen.getByLabelText("src/app.ts before")).toHaveTextContent("broken");
      expect(screen.getByLabelText("src/app.ts after")).toHaveTextContent("fixed");
      const eventsList = screen.getByLabelText("Run events");
      expect(within(eventsList).getByText(/DANGEROUS_ACTION_DENIED/i)).toBeInTheDocument();
      expect(within(eventsList).getByText(/ValidationResult SKIPPED/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: /Approve and continue/i }));
      expect(fetchSpy).toHaveBeenCalledWith("/api/runs/run-1/approvals/demo-finish", expect.objectContaining({ method: "POST" }));
      expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining("apiKey"));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
