import { describe, expect, it } from "vitest";

import { runEmbeddedLocalSession, type InjectableApp } from "../src/local-session.js";
import type { CredentialStore } from "@gcah/credentials";

function credentialStore(): CredentialStore {
  return {
    async status(provider) {
      return { available: true, provider, source: "os", backend: "fake", updatedAt: "2026-01-01T00:00:00.000Z" };
    },
    async set() {},
    async update() {},
    async clear() {},
    async withCredential(_provider, callback) {
      return callback("sk-test-secret");
    }
  };
}

describe("embedded local session", () => {
  it("registers a workspace, submits a run, renders persisted events, and closes the app", async () => {
    const requests: unknown[] = [];
    let closed = false;
    const app: InjectableApp = {
      async inject(request) {
        requests.push(request);
        if (request.url === "/api/workspaces") return { statusCode: 201, json: () => ({ path: "E:/project" }) };
        if (request.url === "/api/runs") return { statusCode: 201, json: () => ({ id: "run-1", status: "COMPLETED" }) };
        if (request.url === "/api/runs/run-1/events?cursor=0") {
          return { statusCode: 200, json: () => ({ events: [{ type: "tool.result", summary: "patched src/app.ts" }] }) };
        }
        return { statusCode: 404, json: () => ({}) };
      },
      async close() {
        closed = true;
      }
    };

    await expect(runEmbeddedLocalSession({
      workspacePath: "E:/project",
      baseUrl: "https://gateway.example/v1",
      model: "Qwen-Coder",
      task: "fix it"
    }, {
      credentialStore: credentialStore(),
      createApp: async () => app
    })).resolves.toMatchObject({ stdout: "Run run-1 COMPLETED\n[tool.result] patched src/app.ts\n" });
    expect(requests).toEqual([
      { method: "POST", url: "/api/workspaces", payload: { path: "E:/project" } },
      { method: "POST", url: "/api/runs", payload: { workspacePath: "E:/project", task: "fix it" } },
      { method: "GET", url: "/api/runs/run-1/events?cursor=0" }
    ]);
    expect(closed).toBe(true);
  });
});
