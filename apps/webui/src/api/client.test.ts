import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client.js";

describe("WebUI API client", () => {
  it("submits approval decisions through same-origin REST", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const client = createApiClient(fetchSpy);

    await expect(client.submitApproval("run-1", "action-1", {
      decision: "approve_once",
      reason: "Reviewed safe patch"
    })).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledWith("/api/runs/run-1/approvals/action-1", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve_once", reason: "Reviewed safe patch" })
    });
  });
});
