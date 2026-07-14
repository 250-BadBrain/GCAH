import { describe, expect, it } from "vitest";

import { runCli, type CliTransport } from "../src/main.js";

describe("CLI approval and config commands", () => {
  it("lists approval events and posts approve/reject DTOs without local policy", async () => {
    const requests: Parameters<CliTransport>[0][] = [];
    const transport: CliTransport = async (request) => {
      requests.push(request);
      if (request.url === "/api/runs/run-1/events?cursor=0" && request.method === "GET") {
        return { status: 200, body: { events: [{ id: "event-1", type: "approval.requested", summary: "read README", cursor: 1, createdAt: "2026-07-14T00:00:00.000Z" }], nextCursor: 1 } };
      }
      if (request.url === "/api/runs/run-1/approvals/action-1" && request.method === "POST") {
        return { status: 200, body: { status: "recorded" } };
      }
      return { status: 404, body: { error: "NOT_FOUND" } };
    };

    await expect(runCli(["approval", "list", "run-1"], { transport })).resolves.toMatchObject({ stdout: "event-1 approval.requested read README\n" });
    await expect(runCli(["approval", "approve-once", "run-1", "action-1", "--reason", "ok"], { transport })).resolves.toMatchObject({ stdout: "recorded\n" });
    await expect(runCli(["approval", "reject", "run-1", "action-1", "--reason", "no"], { transport })).resolves.toMatchObject({ stdout: "recorded\n" });

    expect(requests[1]?.body).toEqual({ decision: "approve_once", reason: "ok" });
    expect(requests[2]?.body).toEqual({ decision: "reject", reason: "no" });
  });

  it("prints non-sensitive config status", async () => {
    const transport: CliTransport = async () => ({
      status: 200,
      body: { mode: "local", llmProvider: "mock", publicDemo: false }
    });

    await expect(runCli(["config", "status"], { transport })).resolves.toMatchObject({
      stdout: "mode=local llm=mock publicDemo=false\n"
    });
  });
});
