import Fastify, { type FastifyInstance } from "fastify";
import { Readable } from "node:stream";
import type { EventDto, Run, RunDto } from "@gcah/shared";

import { registerStaticWebui } from "./static-webui.js";
import { demoWebScenarios } from "./demo-web-fixtures.js";
import { approveDemoRun, startDemoHarnessRun, type DemoHarnessRun } from "./demo-web-harness.js";

export { demoWebScenarios };

export interface DemoWebAppOptions {
  distDir: string;
  sseIdleTimeoutMs?: number;
  onAgentLoopStart?: (input: { scenarioId: string; runId: string }) => void;
}

interface StoredDemoRun extends DemoHarnessRun {
  scenarioId: string;
}

export async function createDemoWebApp(options: DemoWebAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const runs = new Map<string, StoredDemoRun>();
  const scenarios = new Map(demoWebScenarios.map((scenario) => [scenario.id, scenario]));

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.includes("credential") || request.url.includes("upload")) {
      return reply.code(403).send({ error: "PUBLIC_DEMO_CAPABILITY_DENIED" });
    }
  });

  app.get("/health", async () => ({ ok: true, mode: "public-demo", llmProvider: "mock", harness: "AgentLoop" }));

  app.get("/api/public-demo/examples", async () => ({
    examples: demoWebScenarios.map(({ id, title, marker, task }) => ({ id, title, marker, task }))
  }));

  app.post("/api/public-demo/runs", async (request, reply) => {
    const body = request.body;
    if (!isRecord(body) || typeof body.exampleId !== "string" || Object.keys(body).some((key) => key !== "exampleId")) {
      return reply.code(403).send({ error: "PUBLIC_DEMO_CAPABILITY_DENIED" });
    }
    const scenario = scenarios.get(body.exampleId);
    if (scenario === undefined) return reply.code(403).send({ error: "PUBLIC_DEMO_CAPABILITY_DENIED" });
    const harnessOptions = options.onAgentLoopStart === undefined ? {} : { onAgentLoopStart: options.onAgentLoopStart };
    const started = await startDemoHarnessRun(scenario, harnessOptions);
    runs.set(started.run.id, { ...started, scenarioId: scenario.id });
    return reply.code(201).send({ ...toRunDto(started.run), runId: started.run.id, marker: scenario.marker });
  });

  app.get("/api/runs", async () => ({ runs: [...runs.values()].map((stored) => toRunDto(stored.run)) }));

  app.get("/api/runs/:id", async (request, reply) => {
    const stored = runs.get((request.params as { id: string }).id);
    if (stored === undefined) return reply.code(404).send({ error: "NOT_FOUND" });
    const latest = await stored.unitOfWork.repositories.runs.getById(stored.run.id);
    return toRunDto(latest ?? stored.run);
  });

  app.get("/api/runs/:id/files", async (request, reply) => {
    const stored = runs.get((request.params as { id: string }).id);
    if (stored === undefined) return reply.code(404).send({ error: "NOT_FOUND" });
    return { workspace: "isolated-demo-workspace", before: stored.beforeFiles, after: stored.afterFiles };
  });

  app.get("/api/runs/:id/events", async (request, reply) => {
    const stored = runs.get((request.params as { id: string }).id);
    if (stored === undefined) return reply.code(404).send({ error: "NOT_FOUND" });
    const cursor = Number((request.query as { cursor?: string }).cursor ?? 0);
    const events = await stored.unitOfWork.repositories.events.listAfterCursor(stored.run.id, cursor);
    return { events: events.map(toEventDto), nextCursor: events.at(-1)?.cursor ?? null };
  });

  app.get("/api/runs/:id/events/stream", async (request, reply) => {
    const stored = runs.get((request.params as { id: string }).id);
    if (stored === undefined) return reply.code(404).send({ error: "NOT_FOUND" });
    const cursor = Number(request.headers["last-event-id"] ?? (request.query as { cursor?: string }).cursor ?? 0);
    const events = await stored.unitOfWork.repositories.events.listAfterCursor(stored.run.id, cursor);
    const stream = new Readable({ read() {} });
    for (const event of events) stream.push(formatSse(toEventDto(event)));
    setTimeout(() => stream.push(null), options.sseIdleTimeoutMs ?? 25);
    return reply
      .header("content-type", "text/event-stream; charset=utf-8")
      .header("cache-control", "no-cache")
      .send(stream);
  });

  app.post("/api/runs/:id/approvals/:actionId", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const stored = runs.get(id);
    if (stored === undefined) return reply.code(404).send({ error: "NOT_FOUND" });
    const run = await approveDemoRun(id);
    if (run === null) return reply.code(409).send({ error: "APPROVAL_NOT_PENDING" });
    runs.set(id, { ...stored, run, afterFiles: await readCurrentFiles(stored) });
    return toRunDto(run);
  });

  await registerStaticWebui(app, { distDir: options.distDir });
  return app;
}

async function readCurrentFiles(stored: StoredDemoRun): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  for (const path of Object.keys(stored.beforeFiles)) {
    output[path] = await import("node:fs/promises").then(async ({ readFile }) => await readFile(`${stored.workspaceRoot}/${path}`, "utf8"));
  }
  return output;
}

function toRunDto(run: Run): RunDto {
  return {
    id: run.id,
    status: run.status,
    taskSummary: run.taskSummary,
    stopReason: run.stopReason,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt
  };
}

function toEventDto(event: { id: string; type: string; summary: string; cursor: number; createdAt: string }): EventDto {
  return {
    id: event.id,
    type: event.type,
    summary: event.summary,
    cursor: event.cursor,
    createdAt: event.createdAt
  };
}

function formatSse(event: EventDto): string {
  return [`id: ${event.cursor}`, `data: ${JSON.stringify(event)}`, "", ""].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
