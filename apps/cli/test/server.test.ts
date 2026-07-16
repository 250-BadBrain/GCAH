import { describe, expect, it } from "vitest";

import { runCli } from "../src/main.js";
import type { CredentialStore } from "@gcah/credentials";

describe("CLI server commands", () => {
  it("validates local production server start options and backend unavailable errors", async () => {
    await expect(runCli(["server", "start"])).resolves.toMatchObject({
      stderr: "missing server start options\n"
    });
    const unavailableStore: CredentialStore = {
      async status(provider) {
        return { available: false, provider, source: "os", reason: "backend-unavailable", updatedAt: null };
      },
      async set() {},
      async update() {},
      async clear() {},
      async withCredential() {
        throw new Error("backend unavailable");
      }
    };
    await expect(runCli(["credential", "status"], { credentialStore: unavailableStore })).resolves.toMatchObject({
      stderr: "credential backend unavailable\n",
      exitCode: 2
    });
  });

  it("submits workspace and run event client commands", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    const transport = async (request: { method: "GET" | "POST"; url: string; body?: unknown }) => {
      calls.push(request);
      if (request.url === "/api/workspaces") return { status: 201, body: { path: "E:/project" } };
      if (request.url === "/api/runs/run-1/events?cursor=0") {
        return { status: 200, body: { events: [{ id: "event-1", type: "run.completed", summary: "done" }] } };
      }
      return { status: 404, body: null };
    };
    await expect(runCli(["workspace", "add", "--path", "E:/project"], { transport })).resolves.toMatchObject({ stdout: "E:/project\n" });
    await expect(runCli(["run", "events", "run-1"], { transport })).resolves.toMatchObject({ stdout: "event-1 run.completed done\n" });
    expect(calls).toEqual([
      { method: "POST", url: "/api/workspaces", body: { path: "E:/project" } },
      { method: "GET", url: "/api/runs/run-1/events?cursor=0" }
    ]);
  });
});
