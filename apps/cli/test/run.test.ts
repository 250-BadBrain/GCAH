import { describe, expect, it } from "vitest";

import { runCli, type CliTransport } from "../src/main.js";

describe("CLI run commands", () => {
  it("submits, statuses, cancels, and clones runs through HTTP DTOs", async () => {
    const requests: Parameters<CliTransport>[0][] = [];
    const transport: CliTransport = async (request) => {
      requests.push(request);
      if (request.url === "/api/runs" && request.method === "POST") {
        return { status: 201, body: run("run-1", "RUNNING") };
      }
      if (request.url === "/api/runs/run-1" && request.method === "GET") {
        return { status: 200, body: run("run-1", "RUNNING") };
      }
      if (request.url === "/api/runs/run-1/cancel" && request.method === "POST") {
        return { status: 200, body: run("run-1", "CANCELLED") };
      }
      if (request.url === "/api/runs/run-1/clone" && request.method === "POST") {
        return { status: 201, body: run("run-2", "PENDING") };
      }
      return { status: 404, body: { error: "NOT_FOUND" } };
    };

    await expect(runCli(["run", "submit", "--workspace", "E:/workspace", "--task", "fix"], { transport })).resolves.toMatchObject({ stdout: "run-1\n" });
    await expect(runCli(["run", "status", "run-1"], { transport })).resolves.toMatchObject({ stdout: "run-1 RUNNING\n" });
    await expect(runCli(["run", "cancel", "run-1"], { transport })).resolves.toMatchObject({ stdout: "run-1 CANCELLED\n" });
    await expect(runCli(["run", "clone", "run-1"], { transport })).resolves.toMatchObject({ stdout: "run-2 PENDING\n" });

    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ["POST", "/api/runs"],
      ["GET", "/api/runs/run-1"],
      ["POST", "/api/runs/run-1/cancel"],
      ["POST", "/api/runs/run-1/clone"]
    ]);
  });
});

function run(id: string, status: string): unknown {
  return {
    id,
    status,
    taskSummary: "task",
    stopReason: null,
    createdAt: "2026-07-14T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z"
  };
}
