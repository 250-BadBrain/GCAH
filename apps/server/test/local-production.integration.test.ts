import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, readFile as readText, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { CredentialStore } from "@gcah/credentials";

import { createLocalProductionApp } from "../src/local-production.js";
import { createPublicDemoApp } from "../src/public-demo.js";

describe("local production composition", () => {
  it("honors explicit no-validation without falling back to the legacy demo validator", async () => {
    const root = await mkdtemp(join(tmpdir(), "gcah-prod-no-validation-"));
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "export const value = \"broken\";\n", "utf8");
    const brokenHash = sha256("export const value = \"broken\";\n");
    let requests = 0;
    const fake = await fakeOpenAiServer(() => {
      requests += 1;
      const response = requests === 1
        ? { kind: "tool", tool: "patch", args: { path: "src/app.ts", baseSha256: brokenHash, unifiedDiff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@\n-export const value = \"broken\";\n+export const value = \"changed-without-validation\";\n" }, rationale: "change" }
        : { kind: "finish", summary: "complete without validation", rationale: "no validators configured" };
      return { choices: [{ message: { content: JSON.stringify(response) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
    });
    const app = await createLocalProductionApp({
      dataDir: await mkdtemp(join(tmpdir(), "gcah-prod-data-")),
      credentialStore: fakeStore("sk-prod-sentinel"),
      baseUrl: fake.url,
      model: "course-model",
      allowedWorkspaceRoots: [root],
      validationCommand: null
    });

    try {
      await app.inject({ method: "POST", url: "/api/workspaces", payload: { path: root } });
      const submitted = await app.inject({ method: "POST", url: "/api/runs", payload: { workspacePath: root, task: "change without validation" } });
      expect(submitted.statusCode, submitted.body).toBe(201);
      const run = JSON.parse(submitted.body) as { id: string; status: string; stopReason: string };
      expect(run).toMatchObject({ status: "COMPLETED", stopReason: "COMPLETED" });
      await expect(readFile(join(root, "src", "app.ts"), "utf8")).resolves.toContain("changed-without-validation");
      const events = await app.inject({ method: "GET", url: `/api/runs/${run.id}/events?cursor=0` });
      expect(events.body).not.toContain("validation.fail");
      expect(events.body).not.toContain("src/app.ts does not contain fixed");
    } finally {
      await app.close();
      await fake.close();
    }
  });

  it("submits a run through real OpenAI-compatible LLM, AgentLoop, tools, validation, and SQLite without leaking the key", async () => {
    const root = await mkdtemp(join(tmpdir(), "gcah-prod-workspace-"));
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "README.md"), "Make src/app.ts export fixed.\n", "utf8");
    await writeFile(join(root, "src", "app.ts"), "export const value = \"broken\";\n", "utf8");
    await writeFile(join(root, "package.json"), `${JSON.stringify({
      scripts: {
        test: "node -e \"const fs=require('fs');process.exit(fs.readFileSync('src/app.ts','utf8').includes('fixed')?0:1)\""
      }
    }, null, 2)}\n`, "utf8");
    const brokenHash = sha256("export const value = \"broken\";\n");
    const almostHash = sha256("export const value = \"almost\";\n");
    const requests: Array<{ authorization: string | undefined; body: unknown }> = [];
    const fake = await fakeOpenAiServer(async (body, authorization) => {
      requests.push({ authorization, body });
      const count = requests.length;
      const response = count === 1
        ? { kind: "tool", tool: "read", args: { path: "README.md" }, rationale: "inspect" }
        : count === 2
          ? { kind: "tool", tool: "patch", args: { path: "src/app.ts", baseSha256: brokenHash, unifiedDiff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@\n-export const value = \"broken\";\n+export const value = \"almost\";\n" }, rationale: "first fix" }
          : count === 3
            ? { kind: "finish", summary: "too soon", rationale: "maybe fixed" }
            : count === 4
              ? { kind: "tool", tool: "patch", args: { path: "src/app.ts", baseSha256: almostHash, unifiedDiff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@\n-export const value = \"almost\";\n+export const value = \"fixed\";\n" }, rationale: "change after feedback" }
              : { kind: "finish", summary: "complete", rationale: "validation passed" };
      return { choices: [{ message: { content: JSON.stringify(response) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
    });
    const dataDir = await mkdtemp(join(tmpdir(), "gcah-prod-data-"));
    const app = await createLocalProductionApp({
      dataDir,
      credentialStore: fakeStore("sk-prod-sentinel"),
      baseUrl: fake.url,
      model: "course-model",
      allowedWorkspaceRoots: [root],
      validationCommand: { id: "test", executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 30000 }
    });

    try {
      const workspace = await app.inject({ method: "POST", url: "/api/workspaces", payload: { path: root } });
      expect(workspace.statusCode).toBe(201);
      const submitted = await app.inject({ method: "POST", url: "/api/runs", payload: { workspacePath: root, task: "fix tests" } });
      expect(submitted.statusCode, submitted.body).toBe(201);
      const run = JSON.parse(submitted.body) as { id: string; status: string; stopReason: string };
      expect(run).toMatchObject({ status: "COMPLETED", stopReason: "COMPLETED" });
      await expect(readFile(join(root, "src", "app.ts"), "utf8")).resolves.toContain("\"fixed\"");
      expect(requests.map((request) => request.authorization)).toEqual([
        "Bearer sk-prod-sentinel",
        "Bearer sk-prod-sentinel",
        "Bearer sk-prod-sentinel",
        "Bearer sk-prod-sentinel",
        "Bearer sk-prod-sentinel"
      ]);
      expect(JSON.stringify(requests.map((request) => request.body))).not.toContain("sk-prod-sentinel");
      expect(JSON.stringify(requests[2]?.body)).toContain("Validation failed");

      const events = await app.inject({ method: "GET", url: `/api/runs/${run.id}/events?cursor=0` });
      expect(events.body).toContain("tool.result");
      expect(events.body).toContain("validation.fail");
      expect(events.body).toContain("validation.pass");
      expect(events.body).not.toContain("sk-prod-sentinel");
      await expect(readText(join(dataDir, "gcah.sqlite"), "utf8")).resolves.not.toContain("sk-prod-sentinel");
    } finally {
      await app.close();
      await fake.close();
    }
  });

  it("fails closed when the credential backend is unavailable and keeps public demo mock-only", async () => {
    const root = await mkdtemp(join(tmpdir(), "gcah-prod-workspace-"));
    await writeFile(join(root, "README.md"), "x", "utf8");
    const app = await createLocalProductionApp({
      dataDir: await mkdtemp(join(tmpdir(), "gcah-prod-data-")),
      credentialStore: unavailableStore(),
      baseUrl: "http://127.0.0.1:1/v1",
      model: "course-model",
      allowedWorkspaceRoots: [root]
    });
    try {
      await app.inject({ method: "POST", url: "/api/workspaces", payload: { path: root } });
      const submitted = await app.inject({ method: "POST", url: "/api/runs", payload: { workspacePath: root, task: "fail closed" } });
      expect(submitted.statusCode).toBe(503);
      expect(submitted.body).not.toContain("sk-prod-sentinel");
    } finally {
      await app.close();
    }

    const publicDemo = createPublicDemoApp({ examples: [{ id: "safe", title: "Safe", task: "mock" }] });
    const rejected = await publicDemo.inject({ method: "POST", url: "/api/public-demo/runs", payload: { exampleId: "safe", apiKey: "sk-prod-sentinel" } });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.body).not.toContain("sk-prod-sentinel");
    await publicDemo.close();
  });
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fakeStore(secret: string): CredentialStore {
  return {
    async status() {
      return { available: true, provider: "openai-compatible", source: "os", backend: "native-windows", updatedAt: null };
    },
    async set() {},
    async update() {},
    async clear() {},
    async withCredential(_provider, callback) {
      return callback(secret);
    }
  };
}

function unavailableStore(): CredentialStore {
  return {
    async status() {
      return { available: false, provider: "openai-compatible", source: "os", reason: "backend-unavailable", updatedAt: null };
    },
    async set() {
      throw new Error("backend unavailable");
    },
    async update() {
      throw new Error("backend unavailable");
    },
    async clear() {
      throw new Error("backend unavailable");
    },
    async withCredential() {
      throw new Error("backend unavailable");
    }
  };
}

async function fakeOpenAiServer(handler: (body: unknown, authorization: string | undefined) => unknown | Promise<unknown>): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", async () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
      const payload = await handler(body, request.headers.authorization);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("missing test server address");
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    close: async () => await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)))
  };
}
