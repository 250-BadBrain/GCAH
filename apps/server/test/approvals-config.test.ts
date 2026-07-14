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

describe("server approval, config, and credential-status routes", () => {
  it("records approval decisions as committed events", async () => {
    const unitOfWork = createInMemoryRepositories(new FakeClock());
    const app = createServerApp({ unitOfWork, clock: new FakeClock(), auth: { enabled: false } });

    const response = await app.inject({
      method: "POST",
      url: "/api/runs/run-1/approvals/action-1",
      payload: { decision: "reject", reason: "outside approved scope" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "recorded" });
    await expect(unitOfWork.repositories.events.listAfterCursor("run-1", 0)).resolves.toMatchObject([
      { type: "approval.decision", relatedEntityId: "action-1", summary: "approval decision: reject" }
    ]);
  });

  it("rejects malformed approval decisions", async () => {
    const unitOfWork = createInMemoryRepositories(new FakeClock());
    const app = createServerApp({ unitOfWork, clock: new FakeClock(), auth: { enabled: false } });

    const response = await app.inject({
      method: "POST",
      url: "/api/runs/run-1/approvals/action-1",
      payload: { decision: "approve_once" }
    });

    expect(response.statusCode).toBe(400);
    await expect(unitOfWork.repositories.events.listAfterCursor("run-1", 0)).resolves.toEqual([]);
  });

  it("returns only non-sensitive config and credential status", async () => {
    const app = createServerApp({
      unitOfWork: createInMemoryRepositories(new FakeClock()),
      clock: new FakeClock(),
      auth: { enabled: false },
      configStatus: { mode: "local", llmProvider: "mock", publicDemo: false },
      credentialStatus: { backend: "unavailable", providers: [{ provider: "openai", configured: false }] }
    });

    await expect(app.inject({ method: "GET", url: "/api/config/status" })).resolves.toMatchObject({
      statusCode: 200,
      body: JSON.stringify({ mode: "local", llmProvider: "mock", publicDemo: false })
    });
    await expect(app.inject({ method: "GET", url: "/api/credential-status" })).resolves.toMatchObject({
      statusCode: 200,
      body: JSON.stringify({ backend: "unavailable", providers: [{ provider: "openai", configured: false }] })
    });
  });
});
