import { describe, expect, it } from "vitest";

import { runLocalRepl, type LocalReplDeps } from "../src/local-repl.js";
import type { CredentialStore } from "@gcah/credentials";
import type { InjectableApp } from "../src/local-session.js";

function credentialStore(): CredentialStore {
  let stored: string | null = "sk-existing-secret";
  return {
    async status(provider) {
      return stored === null
        ? { available: false, provider, source: "os", reason: "missing", backend: "fake", updatedAt: null }
        : { available: true, provider, source: "os", backend: "fake", updatedAt: null };
    },
    async set(_provider, secret) {
      stored = secret;
    },
    async update(_provider, secret) {
      stored = secret;
    },
    async clear() {
      stored = null;
    },
    async withCredential(_provider, callback) {
      return callback("sk-test-secret");
    }
  };
}

describe("local REPL", () => {
  it("runs repeated tasks, renders persisted events, supports status, and exits cleanly", async () => {
    const requests: unknown[] = [];
    let closed = false;
    const app: InjectableApp = {
      async inject(request) {
        requests.push(request);
        if (request.url === "/api/workspaces") return { statusCode: 201, json: () => ({ path: "E:/project" }) };
        if (request.url === "/api/runs" && isTask(request.payload, "first")) return { statusCode: 201, json: () => ({ id: "run-1", status: "COMPLETED", stopReason: "COMPLETED" }) };
        if (request.url === "/api/runs" && isTask(request.payload, "second")) return { statusCode: 201, json: () => ({ id: "run-2", status: "STOPPED", stopReason: "BUDGET_EXHAUSTED" }) };
        if (request.url === "/api/runs/run-1/events?cursor=0") return { statusCode: 200, json: () => ({ events: [{ type: "tool.result", summary: "sha256=abc123\nexport const secret = 'sk-test-secret';" }] }) };
        if (request.url === "/api/runs/run-2/events?cursor=0") return { statusCode: 200, json: () => ({ events: [{ type: "validation.fail", summary: "command failed 1" }] }) };
        return { statusCode: 404, json: () => ({ error: "missing" }) };
      },
      async close() {
        closed = true;
      }
    };
    const inputs = ["first", "/status", "second", "/exit"];
    const written: string[] = [];
    const deps: LocalReplDeps = {
      credentialStore: credentialStore(),
      createApp: async () => app,
      promptLine: async () => inputs.shift() ?? "/exit",
      writeLine: (line) => {
        written.push(line);
      }
    };

    const result = await runLocalRepl({ workspacePath: "E:/project", baseUrl: "https://gateway.example/v1", model: "Qwen-Coder", validation: "pnpm-test" }, deps);

    expect(result.stdout).toBe("");
    expect(written).toContain("GCAH local interactive session");
    expect(written).toContain("Run run-1 COMPLETED stop=COMPLETED");
    expect(written).toContain("Tool: read file");
    expect(written).toContain("Status:");
    expect(written).toContain("  workspace:  E:/project");
    expect(written).toContain("  model:      Qwen-Coder");
    expect(written).toContain("Run run-2 STOPPED stop=BUDGET_EXHAUSTED");
    expect(written).toContain("Validation failed: command failed 1");
    expect(written).toContain("summary: budget exhausted; last=Validation failed: command failed 1");
    expect(closed).toBe(true);
    expect(requests).toContainEqual({ method: "POST", url: "/api/runs", payload: { workspacePath: "E:/project", task: "first" } });
    expect(requests).toContainEqual({ method: "POST", url: "/api/runs", payload: { workspacePath: "E:/project", task: "second" } });
  });

  it("approves waiting runs through the existing approval endpoint", async () => {
    const requests: unknown[] = [];
    const app: InjectableApp = {
      async inject(request) {
        requests.push(request);
        if (request.url === "/api/workspaces") return { statusCode: 201, json: () => ({ path: "E:/project" }) };
        if (request.url === "/api/runs") return { statusCode: 201, json: () => ({ id: "run-approval", status: "WAITING_APPROVAL", stopReason: null }) };
        if (request.url === "/api/runs/run-approval/events?cursor=0") {
          return { statusCode: 200, json: () => ({ events: [{ type: "approval.required", summary: "approval required for action:run-approval:1" }] }) };
        }
        if (request.url === "/api/runs/run-approval/approvals/action:run-approval:1") return { statusCode: 200, json: () => ({ id: "run-approval", status: "COMPLETED", stopReason: "COMPLETED" }) };
        return { statusCode: 404, json: () => ({}) };
      },
      async close() {}
    };
    const inputs = ["mutate", "o", "/exit"];
    const written: string[] = [];

    const result = await runLocalRepl({
      workspacePath: "E:/project",
      baseUrl: "https://gateway.example/v1",
      model: "Qwen-Coder",
      validation: "pnpm-test"
    }, {
      credentialStore: credentialStore(),
      createApp: async () => app,
      promptLine: async () => inputs.shift() ?? "/exit",
      writeLine: (line) => {
        written.push(line);
      }
    });

    expect(result.stdout).toBe("");
    expect(written).toContain("approval approve_once");
    expect(requests).toContainEqual({
      method: "POST",
      url: "/api/runs/run-approval/approvals/action:run-approval:1",
      payload: { decision: "approve_once", reason: "local repl approval" }
    });
  });

  it("renders help as multiple lines and clear as a terminal control sequence", async () => {
    const written: string[] = [];
    const inputs = ["/help", "/clear", "/exit"];
    await runLocalRepl({
      workspacePath: "E:/project",
      baseUrl: "https://gateway.example/v1",
      model: "Qwen-Coder",
      validation: "pnpm-test"
    }, {
      credentialStore: credentialStore(),
      createApp: async () => ({
        async inject(request) {
          if (request.url === "/api/workspaces") return { statusCode: 201, json: () => ({ path: "E:/project" }) };
          return { statusCode: 404, json: () => ({}) };
        },
        async close() {}
      }),
      promptLine: async () => inputs.shift() ?? "/exit",
      writeLine: (line) => {
        written.push(line);
      }
    });

    expect(written).toContain("Commands:");
    expect(written).toContain("  /status               Show workspace, model, validation, and current run.");
    expect(written).toContain("  /credential status    Check whether the provider key is configured.");
    expect(written).toContain("\u001b[2J\u001b[H");
  });

  it("manages credentials inside the interactive session", async () => {
    const written: string[] = [];
    const inputs = ["/credential status", "/credential clear", "/credential status", "/credential set", "/credential status", "/exit"];
    const secrets = ["sk-new-secret"];
    await runLocalRepl({
      workspacePath: "E:/project",
      baseUrl: "https://gateway.example/v1",
      model: "Qwen-Coder",
      validation: "pnpm-test"
    }, {
      credentialStore: credentialStore(),
      createApp: async () => ({
        async inject(request) {
          if (request.url === "/api/workspaces") return { statusCode: 201, json: () => ({ path: "E:/project" }) };
          return { statusCode: 404, json: () => ({}) };
        },
        async close() {}
      }),
      promptLine: async () => inputs.shift() ?? "/exit",
      promptSecret: async () => secrets.shift() ?? "",
      writeLine: (line) => {
        written.push(line);
      }
    });

    expect(written).toContain("credential: configured backend=fake");
    expect(written).toContain("credential: cleared");
    expect(written).toContain("credential: missing");
    expect(written).toContain("credential: stored");
  });

  it("recreates the embedded app when the workspace changes", async () => {
    const allowedRoots: string[][] = [];
    let closed = 0;
    const inputs = ["/workspace E:/real-project", "/exit"];
    const written: string[] = [];

    const result = await runLocalRepl({
      workspacePath: "E:/missing-project",
      baseUrl: "https://gateway.example/v1",
      model: "Qwen-Coder",
      validation: "pnpm-test"
    }, {
      credentialStore: credentialStore(),
      createApp: async (input) => {
        allowedRoots.push(input.allowedWorkspaceRoots);
        const root = input.allowedWorkspaceRoots[0];
        return {
          async inject(request) {
            if (request.url === "/api/workspaces" && root === "E:/missing-project") {
              return { statusCode: 500, json: () => ({ error: "ENOENT" }) };
            }
            if (request.url === "/api/workspaces" && root === "E:/real-project") {
              return { statusCode: 201, json: () => ({ path: "E:/real-project" }) };
            }
            return { statusCode: 404, json: () => ({}) };
          },
          async close() {
            closed += 1;
          }
        };
      },
      promptLine: async () => inputs.shift() ?? "/exit",
      writeLine: (line) => {
        written.push(line);
      }
    });

    expect(result.stdout).toBe("");
    expect(allowedRoots).toEqual([["E:/missing-project"], ["E:/real-project"]]);
    expect(written).toContain("workspace registration failed: {\"error\":\"ENOENT\"}");
    expect(written).toContain("workspace=E:/real-project");
    expect(closed).toBe(2);
  });
});

function isTask(value: unknown, task: string): boolean {
  return typeof value === "object" && value !== null && "task" in value && value.task === task;
}
