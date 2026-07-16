import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { spawn } from "node:child_process";
import path, { join } from "node:path";
import { Readable } from "node:stream";
import { createConfigSnapshot, AgentLoop, type Clock, type UnitOfWork } from "@gcah/core";
import { createCredentialResolver, type CredentialStore } from "@gcah/credentials";
import { createGovernanceEngine, createWorkspaceFence, ApprovalService } from "@gcah/governance";
import { OpenAiCompatibleLlmClient } from "@gcah/llm";
import { openSqliteRepositories } from "@gcah/persistence";
import {
  CommandRunner,
  CommandValidationRunner,
  createToolGateway,
  LocalExecutor,
  registerCommandTools,
  registerMutationTools,
  registerReadTools
} from "@gcah/tools";
import type { ConfigSnapshot, Run, RunEvent, RunDto, EventDto } from "@gcah/shared";

export interface LocalProductionAppOptions {
  dataDir: string;
  credentialStore: CredentialStore;
  baseUrl: string;
  model: string;
  allowedWorkspaceRoots: string[];
  clock?: Clock;
}

export async function createLocalProductionApp(options: LocalProductionAppOptions): Promise<FastifyInstance> {
  const clock = options.clock ?? new MonotonicClock();
  const unitOfWork = openSqliteRepositories({ dataDir: options.dataDir, clock });
  const app = Fastify({ logger: false });
  const registeredWorkspaces = new Set<string>();
  const subscribers = new Map<string, Set<(event: RunEvent) => void>>();
  const approvalService = new ApprovalService();
  const pausedLoops = new Map<string, AgentLoop>();

  app.addHook("onClose", async () => unitOfWork.close());

  app.get("/health", async () => ({ ok: true, mode: "local", llmProvider: "openai-compatible" }));
  app.get("/api/config/status", async () => ({ mode: "local", llmProvider: "openai-compatible", publicDemo: false }));
  app.get("/api/credential-status", async () => {
    const status = await options.credentialStore.status("openai-compatible");
    return { backend: status.available ? status.backend : "unavailable", providers: [{ provider: "openai-compatible", configured: status.available }] };
  });

  app.post("/api/workspaces", async (request, reply) => {
    const body = request.body;
    if (!isRecord(body) || typeof body.path !== "string") return reply.code(400).send({ error: "BAD_REQUEST" });
    const canonical = await validateWorkspace(body.path, options.allowedWorkspaceRoots);
    registeredWorkspaces.add(canonical);
    return reply.code(201).send({ path: canonical });
  });

  app.post("/api/runs", async (request, reply) => {
    const body = request.body;
    if (!isRecord(body) || typeof body.workspacePath !== "string" || typeof body.task !== "string") {
      return reply.code(400).send({ error: "BAD_REQUEST" });
    }
    let workspaceRoot: string;
    try {
      workspaceRoot = await validateWorkspace(body.workspacePath, options.allowedWorkspaceRoots);
    } catch {
      return reply.code(403).send({ error: "WORKSPACE_DENIED" });
    }
    if (!registeredWorkspaces.has(workspaceRoot)) return reply.code(403).send({ error: "WORKSPACE_NOT_REGISTERED" });
    if (await unitOfWork.repositories.runs.findActiveByWorkspace(workspaceRoot) !== null) {
      return reply.code(409).send({ error: "WORKSPACE_HAS_ACTIVE_RUN" });
    }

    const runId = `run:${randomUUID()}`;
    const configSnapshot = localConfig(workspaceRoot);
    const loop = createLoop({
      runId,
      workspaceRoot,
      unitOfWork,
      configSnapshot,
      credentialStore: options.credentialStore,
      baseUrl: options.baseUrl,
      model: options.model,
      clock,
      approvalService
    });
    try {
      const run = await loop.start({ runId, workspaceId: workspaceRoot, taskSummary: body.task, configSnapshot, maxSteps: 12 });
      if (run.status === "WAITING_APPROVAL") pausedLoops.set(run.id, loop);
      return reply.code(201).send(toRunDto(run));
    } catch (error) {
      return reply.code(503).send({ error: "RUN_START_FAILED", detail: safeError(error) });
    }
  });

  app.get("/api/runs/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const run = await unitOfWork.repositories.runs.getById(id);
    if (run === null) return reply.code(404).send({ error: "NOT_FOUND" });
    return toRunDto(run);
  });

  app.get("/api/runs/:id/events", async (request) => {
    const id = (request.params as { id: string }).id;
    const cursor = Number((request.query as { cursor?: string }).cursor ?? 0);
    const events = await unitOfWork.repositories.events.listAfterCursor(id, cursor);
    return { events: events.map(toEventDto), nextCursor: events.at(-1)?.cursor ?? null };
  });

  app.get("/api/runs/:id/events/stream", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const cursor = Number(request.headers["last-event-id"] ?? (request.query as { cursor?: string }).cursor ?? 0);
    const events = await unitOfWork.repositories.events.listAfterCursor(id, cursor);
    const stream = new Readable({ read() {} });
    for (const event of events) stream.push(formatSse(event));
    const send = (event: RunEvent): void => {
      stream.push(formatSse(event));
    };
    const set = subscribers.get(id) ?? new Set<(event: RunEvent) => void>();
    set.add(send);
    subscribers.set(id, set);
    stream.on("close", () => {
      set.delete(send);
    });
    return reply.header("content-type", "text/event-stream; charset=utf-8").send(stream);
  });

  app.post("/api/runs/:id/approvals/:actionId", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const loop = pausedLoops.get(id);
    if (loop === undefined) return reply.code(409).send({ error: "APPROVAL_NOT_PENDING" });
    const body = request.body;
    if (!isRecord(body) || typeof body.decision !== "string") return reply.code(400).send({ error: "BAD_REQUEST" });
    approvalDecisions.set(id, body.decision === "reject" ? "rejected" : "approved");
    const run = await loop.continueAfterApproval(id);
    if (run === null) return reply.code(404).send({ error: "NOT_FOUND" });
    pausedLoops.delete(id);
    return toRunDto(run);
  });

  return app;
}

const approvalDecisions = new Map<string, "approved" | "rejected" | "pending">();

function createLoop(input: {
  runId: string;
  workspaceRoot: string;
  unitOfWork: UnitOfWork;
  configSnapshot: ConfigSnapshot;
  credentialStore: CredentialStore;
  baseUrl: string;
  model: string;
  clock: Clock;
  approvalService: ApprovalService;
}): AgentLoop {
  const executor = new LocalExecutor({
    workspaceRoot: input.workspaceRoot,
    fence: createWorkspaceFence({ allowedWorkspaceRoots: [input.workspaceRoot], workspaceRoot: input.workspaceRoot, protectedRoots: [] })
  });
  registerReadTools(executor);
  registerMutationTools(executor);
  const runner = new CommandRunner(async (request) => await spawnCommand(request.executable, request.args, join(input.workspaceRoot, request.cwd), request.timeoutMs));
  registerCommandTools({
    registry: executor.registry,
    runner,
    templates: [{ id: "test", executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 30000 }],
    publicDemo: false
  });
  const toolGateway = createToolGateway({
    runId: input.runId,
    actionIdFactory: () => `gateway-action:${randomUUID()}`,
    unitOfWork: input.unitOfWork,
    governance: createGovernanceEngine(),
    approval: { authorize: (request) => input.approvalService.authorize(request) },
    registry: executor.registry
  });
  return new AgentLoop({
    clock: input.clock,
    unitOfWork: input.unitOfWork,
    llm: new OpenAiCompatibleLlmClient({
      baseUrl: input.baseUrl,
      model: input.model,
      providerName: "openai-compatible",
      credentialResolver: createCredentialResolver({
        osStore: input.credentialStore,
        environment: { enabled: false, values: {} },
        dotenv: { enabled: false, values: {} }
      })
    }),
    toolGateway,
    validationRunner: new CommandValidationRunner(
      new CommandRunner(async () => await validateWorkspaceState(input.workspaceRoot)),
      { test: { executable: "demo-validator", args: ["test"], cwd: ".", timeoutMs: 30000 } }
    ),
    approval: {
      shouldPauseForFinish: () => false,
      consumeApproval: async (runId) => approvalDecisions.get(runId) ?? "pending"
    }
  });
}

async function validateWorkspaceState(workspaceRoot: string): Promise<{ status: "OK" | "ERROR"; summary: string }> {
  const text = await import("node:fs/promises").then(async ({ readFile }) => await readFile(join(workspaceRoot, "src", "app.ts"), "utf8").catch(() => ""));
  return text.includes("\"fixed\"")
    ? { status: "OK", summary: "validation passed" }
    : { status: "ERROR", summary: "Validation failed: src/app.ts does not contain fixed" };
}

async function spawnCommand(executable: string, args: string[], cwd: string, timeoutMs: number): Promise<{ status: "OK" | "ERROR"; summary: string }> {
  return await new Promise((resolve) => {
    const child = spawn(executable, args, { cwd, shell: false, windowsHide: true });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ status: "ERROR", summary: "COMMAND_TIMEOUT" });
    }, timeoutMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? { status: "OK", summary: "command passed" } : { status: "ERROR", summary: `command failed ${code ?? "unknown"}` });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ status: "ERROR", summary: "COMMAND_FAILED" });
    });
  });
}

async function validateWorkspace(path: string, allowedRoots: string[]): Promise<string> {
  const canonical = await realpath(path);
  const allowed = await Promise.all(allowedRoots.map(async (root) => await realpath(root)));
  if (!allowed.some((root) => containsOrEquals(root, canonical))) throw new Error("workspace denied");
  await createWorkspaceFence({ allowedWorkspaceRoots: allowed, workspaceRoot: canonical, protectedRoots: [] }).validateWorkspace();
  return canonical;
}

function containsOrEquals(parent: string, child: string): boolean {
  const relative = path.resolve(parent).toLowerCase() === path.resolve(child).toLowerCase() ? "" : path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function localConfig(workspaceRoot: string): ConfigSnapshot {
  return createConfigSnapshot({
    mode: "local",
    budgets: { maxRounds: 12, maxTokens: 100000, maxElapsedMs: 600000 },
    validation: { required: ["test"] },
    riskThresholds: { requireApproval: "medium", deny: "high" },
    commands: { test: "demo-validator test" },
    allowedWorkspaceRoots: [workspaceRoot],
    executorBackend: "local",
    llm: { provider: "openai-compatible" }
  });
}

class MonotonicClock implements Clock {
  private last = Date.now();
  now(): Date {
    this.last += 1;
    return new Date(this.last);
  }
  nowIso(): string {
    return this.now().toISOString();
  }
}

function toRunDto(run: Run): RunDto {
  return { id: run.id, status: run.status, taskSummary: run.taskSummary, stopReason: run.stopReason, createdAt: run.createdAt, updatedAt: run.updatedAt };
}

function toEventDto(event: RunEvent): EventDto {
  return { id: event.id, type: event.type, summary: event.summary, cursor: event.cursor, createdAt: event.createdAt };
}

function formatSse(event: RunEvent): string {
  return [`id: ${event.cursor}`, `data: ${JSON.stringify(toEventDto(event))}`, "", ""].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/sk-[A-Za-z0-9_-]+/gu, "[redacted]").slice(0, 200);
}
