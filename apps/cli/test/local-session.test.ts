import { describe, expect, it } from "vitest";

import { createPromptApprovalDecider, runEmbeddedLocalSession, type InjectableApp } from "../src/local-session.js";
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
  it("maps inline approval prompts to explicit approval decisions", async () => {
    const prompts: string[] = [];
    const answers = ["o", "session", ""];
    const decide = createPromptApprovalDecider(async (label) => {
      prompts.push(label);
      return answers.shift() ?? "";
    });

    await expect(decide?.({ runId: "run-1", actionId: "action-1", summary: "approval required" })).resolves.toBe("approve_once");
    await expect(decide?.({ runId: "run-1", actionId: "action-2", summary: "approval required" })).resolves.toBe("approve_session");
    await expect(decide?.({ runId: "run-1", actionId: "action-3", summary: "approval required" })).resolves.toBe("reject");
    expect(prompts[0]).toContain("action-1");
  });

  it("registers a workspace, submits a run, renders persisted events, and closes the app", async () => {
    const requests: unknown[] = [];
    let closed = false;
    const app: InjectableApp = {
      async inject(request) {
        requests.push(request);
        if (request.url === "/api/workspaces") return { statusCode: 201, json: () => ({ path: "E:/project" }) };
        if (request.url === "/api/runs") return { statusCode: 201, json: () => ({ id: "run-1", status: "COMPLETED", stopReason: "COMPLETED" }) };
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
    })).resolves.toMatchObject({ stdout: "Run run-1 COMPLETED stop=COMPLETED\n[tool.result] patched src/app.ts\n" });
    expect(requests).toEqual([
      { method: "POST", url: "/api/workspaces", payload: { path: "E:/project" } },
      { method: "POST", url: "/api/runs", payload: { workspacePath: "E:/project", task: "fix it" } },
      { method: "GET", url: "/api/runs/run-1/events?cursor=0" }
    ]);
    expect(closed).toBe(true);
  });

  it("approves a pending action inline and renders resumed events", async () => {
    const requests: unknown[] = [];
    const app: InjectableApp = {
      async inject(request) {
        requests.push(request);
        if (request.url === "/api/workspaces") return { statusCode: 201, json: () => ({ path: "E:/project" }) };
        if (request.url === "/api/runs") return { statusCode: 201, json: () => ({ id: "run-approval", status: "WAITING_APPROVAL" }) };
        if (request.url === "/api/runs/run-approval/approvals/action:run-approval:1") {
          return { statusCode: 200, json: () => ({ id: "run-approval", status: "COMPLETED" }) };
        }
        if (request.url === "/api/runs/run-approval/events?cursor=0") {
          return {
            statusCode: 200,
            json: () => ({
              events: [
                { type: "approval.required", summary: "approval required for action:run-approval:1", relatedEntityId: "action:run-approval:1" },
                { type: "run.completed", summary: "done", relatedEntityId: null }
              ]
            })
          };
        }
        return { statusCode: 404, json: () => ({}) };
      },
      async close() {}
    };

    await expect(runEmbeddedLocalSession({
      workspacePath: "E:/project",
      baseUrl: "https://gateway.example/v1",
      model: "Qwen-Coder",
      task: "fix it"
    }, {
      credentialStore: credentialStore(),
      createApp: async () => app,
      decideApproval: async () => "approve_once"
    })).resolves.toMatchObject({ stdout: expect.stringContaining("Run run-approval COMPLETED") });
    expect(requests).toContainEqual({
      method: "POST",
      url: "/api/runs/run-approval/approvals/action:run-approval:1",
      payload: { decision: "approve_once", reason: "local interactive approval" }
    });
  });
});
