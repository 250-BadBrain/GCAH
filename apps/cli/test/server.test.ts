import { describe, expect, it } from "vitest";

import { runCli } from "../src/main.js";
import type { CredentialStore } from "@gcah/credentials";

describe("CLI server commands", () => {
  it("starts the interactive local agent through an injectable local session", async () => {
    const calls: string[][] = [];
    await expect(runCli(["local", "--workspace", "E:/project", "--base-url", "https://gateway.example/v1", "--model", "DeepSeek-V3", "--task", "fix it"], {
      runLocalSession: async (options) => {
        calls.push([options.workspacePath, options.baseUrl, options.model]);
        return { stdout: "local session complete\n", stderr: "", exitCode: 0 };
      }
    })).resolves.toMatchObject({ stdout: "local session complete\n", exitCode: 0 });
    expect(calls).toEqual([["E:/project", "https://gateway.example/v1", "DeepSeek-V3"]]);
  });

  it("prompts for missing local options and saves a non-secret profile", async () => {
    const prompts: string[] = [];
    const saved: unknown[] = [];
    const answers = ["E:/prompted", "https://gateway.example/v1", "Qwen-Coder"];
    await expect(runCli(["local"], {
      promptLine: async (label) => {
        prompts.push(label);
        return answers.shift() ?? "";
      },
      localProfileStore: {
        load: async () => null,
        save: async (profile) => {
          saved.push(profile);
        }
      },
      runLocalRepl: async (options) => ({ stdout: `${options.workspacePath} ${options.model} ${options.validation}\n`, stderr: "", exitCode: 0 })
    })).resolves.toMatchObject({ stdout: "E:/prompted Qwen-Coder pnpm-test\n" });
    expect(prompts).toEqual(["Workspace", "Base URL", "Model"]);
    expect(JSON.stringify(saved)).not.toContain("sk-");
    expect(saved).toEqual([{ workspacePath: "E:/prompted", baseUrl: "https://gateway.example/v1", model: "Qwen-Coder", validation: "pnpm-test" }]);
  });

  it("rejects arbitrary local validation commands", async () => {
    await expect(runCli(["local", "--workspace", "E:/project", "--base-url", "https://gateway.example/v1", "--model", "DeepSeek-V3", "--validation", "rm -rf"], {
      runLocalSession: async () => ({ stdout: "should not run\n", stderr: "", exitCode: 0 })
    })).resolves.toMatchObject({ stderr: "unsupported local validation\n", exitCode: 2 });
  });

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
