import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { CreateRunRequestSchema, type RunDto } from "@gcah/shared";
import type { Clock, UnitOfWork } from "@gcah/core";
import { cloneInterruptedRunAsPending, transitionRun } from "@gcah/core";

export interface ServerAuthOptions {
  enabled: boolean;
  adminTokenStore?: AdminTokenStore;
  allowedOrigin?: string;
  secureCookies?: boolean;
}

export interface AdminTokenStore {
  verify(token: string): Promise<boolean>;
}

export interface CreateServerAppOptions {
  unitOfWork: UnitOfWork;
  clock: Clock;
  auth: ServerAuthOptions;
}

export function createServerApp(options: CreateServerAppOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  const sessions = new Map<string, string>();

  app.addHook("preHandler", async (request, reply) => {
    if (!options.auth.enabled || request.method === "GET" || request.url === "/api/auth/session") return;
    const origin = request.headers.origin;
    if (origin !== undefined && options.auth.allowedOrigin !== undefined && origin !== options.auth.allowedOrigin) {
      return reply.code(403).send({ error: "BAD_ORIGIN" });
    }
    const sessionId = parseCookie(request.headers.cookie ?? "").get("gcah_session");
    const expectedCsrf = sessionId === undefined ? undefined : sessions.get(sessionId);
    if (expectedCsrf === undefined) return reply.code(401).send({ error: "UNAUTHORIZED" });
    if (request.headers["x-csrf-token"] !== expectedCsrf) return reply.code(403).send({ error: "BAD_CSRF" });
  });

  app.get("/health", async () => ({ ok: true }));

  app.post("/api/auth/session", async (request, reply) => {
    if (!options.auth.enabled || options.auth.adminTokenStore === undefined) return reply.code(404).send({ error: "NOT_FOUND" });
    const token = request.headers["x-admin-token"];
    if (typeof token !== "string" || !(await options.auth.adminTokenStore.verify(token))) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
    const sessionId = randomUUID();
    const csrf = randomUUID();
    sessions.set(sessionId, csrf);
    const secure = options.auth.secureCookies === true ? "; Secure" : "";
    return reply
      .code(204)
      .header("set-cookie", `gcah_session=${sessionId}; HttpOnly; SameSite=Strict; Path=/${secure}`)
      .header("x-csrf-token", csrf)
      .send();
  });

  app.post("/api/runs", async (request, reply) => {
    const parsed = CreateRunRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "BAD_REQUEST" });
    const at = options.clock.nowIso();
    const run = await options.unitOfWork.repositories.runs.create({
      id: `run:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      workspaceId: parsed.data.workspacePath,
      taskSummary: parsed.data.task,
      status: "RUNNING",
      configSnapshotId: "config:server-default",
      budgetUsage: { rounds: 0, tokens: 0, elapsedMs: 0, repeatedFailures: 0 },
      transitionIds: [],
      stopReason: null,
      stopDetail: null,
      createdAt: at,
      updatedAt: at
    });
    await options.unitOfWork.repositories.events.append({
      id: `event:${run.id}:created`,
      runId: run.id,
      stepId: null,
      type: "run.created",
      relatedEntityId: run.id,
      summary: "run created",
      createdAt: at
    });
    return reply.code(201).send(toRunDto(run));
  });

  app.get("/api/runs/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const run = await options.unitOfWork.repositories.runs.getById(id);
    if (run === null) return reply.code(404).send({ error: "NOT_FOUND" });
    return toRunDto(run);
  });

  app.post("/api/runs/:id/cancel", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const run = await options.unitOfWork.repositories.runs.getById(id);
    if (run === null) return reply.code(404).send({ error: "NOT_FOUND" });
    const cancelled = transitionRun(run, { id: `cancel:${id}`, type: "cancel", at: options.clock.nowIso() });
    await options.unitOfWork.repositories.runs.update(cancelled);
    return toRunDto(cancelled);
  });

  app.post("/api/runs/:id/clone", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const clone = await cloneInterruptedRunAsPending(options.unitOfWork.repositories, id, `run:${Date.now()}:${Math.random().toString(16).slice(2)}`, options.clock);
    return reply.code(201).send(toRunDto(clone));
  });

  return app;
}

function parseCookie(header: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey !== undefined && rawKey.length > 0) cookies.set(rawKey, rawValue.join("="));
  }
  return cookies;
}

function toRunDto(run: Awaited<ReturnType<UnitOfWork["repositories"]["runs"]["create"]>>): RunDto {
  return {
    id: run.id,
    status: run.status,
    taskSummary: run.taskSummary,
    stopReason: run.stopReason,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt
  };
}
