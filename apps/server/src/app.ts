import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  ApprovalDecisionRequestSchema,
  CreateRunRequestSchema,
  type ConfigStatusDto,
  type CredentialStatusDto,
  type EventDto,
  type RunDto
} from "@gcah/shared";
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

export type WorkspaceValidationResult =
  | { ok: true; workspaceId?: string }
  | { ok: false; code: string };

export interface CreateServerAppOptions {
  unitOfWork: UnitOfWork;
  clock: Clock;
  auth: ServerAuthOptions;
  configStatus?: ConfigStatusDto;
  credentialStatus?: CredentialStatusDto;
  sseIdleTimeoutMs?: number;
  workspaceValidator?: (workspacePath: string) => Promise<WorkspaceValidationResult>;
}

export function createServerApp(options: CreateServerAppOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  const sessions = new Map<string, string>();
  const subscribers = new Map<string, Set<(event: PersistedEvent) => void>>();

  app.addHook("preHandler", async (request, reply) => {
    if (!options.auth.enabled || !request.url.startsWith("/api/") || request.url === "/api/auth/session") return;
    const sessionId = parseCookie(request.headers.cookie ?? "").get("gcah_session");
    const expectedCsrf = sessionId === undefined ? undefined : sessions.get(sessionId);
    if (expectedCsrf === undefined) return reply.code(401).send({ error: "UNAUTHORIZED" });
    if (request.method !== "GET" && request.method !== "HEAD") {
      const origin = request.headers.origin;
      if (origin !== undefined && options.auth.allowedOrigin !== undefined && origin !== options.auth.allowedOrigin) {
        return reply.code(403).send({ error: "BAD_ORIGIN" });
      }
      if (request.headers["x-csrf-token"] !== expectedCsrf) return reply.code(403).send({ error: "BAD_CSRF" });
    }
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/api/config/status", async () => options.configStatus ?? {
    mode: "local",
    llmProvider: "mock",
    publicDemo: false
  });

  app.get("/api/credential-status", async () => options.credentialStatus ?? {
    backend: "unavailable",
    providers: []
  });

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
    const workspaceValidation = await options.workspaceValidator?.(parsed.data.workspacePath);
    if (workspaceValidation?.ok === false) return reply.code(403).send({ error: workspaceValidation.code });
    const at = options.clock.nowIso();
    const workspaceId = workspaceValidation?.ok === true && workspaceValidation.workspaceId !== undefined
      ? workspaceValidation.workspaceId
      : parsed.data.workspacePath;
    const { run, event } = await options.unitOfWork.transaction(async (repositories) => {
      const created = await repositories.runs.create({
        id: `run:${Date.now()}:${Math.random().toString(16).slice(2)}`,
        workspaceId,
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
      const persistedEvent = await repositories.events.append({
        id: `event:${created.id}:created`,
        runId: created.id,
        stepId: null,
        type: "run.created",
        relatedEntityId: created.id,
        summary: "run created",
        createdAt: at
      });
      return { run: created, event: persistedEvent };
    });
    publish(event);
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

  app.post("/api/runs/:id/approvals/:actionId", async (request, reply) => {
    const parsed = ApprovalDecisionRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "BAD_REQUEST" });
    const { id, actionId } = request.params as { id: string; actionId: string };
    const run = await options.unitOfWork.repositories.runs.getById(id);
    if (run === null) return reply.code(404).send({ error: "NOT_FOUND" });
    const steps = await options.unitOfWork.repositories.steps.listByRun(id);
    let stepId: string | null = null;
    let actionStatus: string | null = null;
    for (const step of steps) {
      const actions = await options.unitOfWork.repositories.actions.listByStep(step.id);
      const action = actions.find((candidate) => candidate.id === actionId);
      if (action !== undefined) {
        stepId = step.id;
        actionStatus = action.status;
        break;
      }
    }
    if (stepId === null) return reply.code(404).send({ error: "NOT_FOUND" });
    if (actionStatus !== "WAITING_APPROVAL") return reply.code(409).send({ error: "APPROVAL_NOT_PENDING" });
    const event = await options.unitOfWork.transaction(async (repositories) => {
      return repositories.events.append({
        id: `event:${id}:${actionId}:approval:${options.clock.now().getTime()}`,
        runId: id,
        stepId,
        type: "approval.decision",
        relatedEntityId: actionId,
        summary: `approval decision: ${parsed.data.decision}`,
        createdAt: options.clock.nowIso()
      });
    });
    publish(event);
    return { status: "recorded" };
  });

  app.get("/api/runs/:id/events", async (request) => {
    const id = (request.params as { id: string }).id;
    const cursor = Number((request.query as { cursor?: string }).cursor ?? 0);
    const events = await options.unitOfWork.repositories.events.listAfterCursor(id, cursor);
    return {
      events: events.map(toEventDto),
      nextCursor: events.at(-1)?.cursor ?? null
    };
  });

  app.get("/api/runs/:id/events/stream", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const cursor = Number(request.headers["last-event-id"] ?? 0);
    const events = await options.unitOfWork.repositories.events.listAfterCursor(id, cursor);
    const stream = new Readable({ read() {} });
    for (const event of events) stream.push(formatSse(event));
    const send = (event: PersistedEvent): void => {
      stream.push(formatSse(event));
    };
    const runSubscribers = subscribers.get(id) ?? new Set<(event: PersistedEvent) => void>();
    runSubscribers.add(send);
    subscribers.set(id, runSubscribers);
    const cleanup = (): void => {
      runSubscribers.delete(send);
      if (runSubscribers.size === 0) subscribers.delete(id);
    };
    const idleTimeout = options.sseIdleTimeoutMs;
    let timer: NodeJS.Timeout | undefined;
    if (idleTimeout !== undefined) {
      timer = setTimeout(() => {
        cleanup();
        stream.push(null);
      }, idleTimeout);
    }
    stream.on("close", () => {
      if (timer !== undefined) clearTimeout(timer);
      cleanup();
    });
    return reply
      .header("content-type", "text/event-stream; charset=utf-8")
      .header("cache-control", "no-cache")
      .send(stream);
  });

  function publish(event: PersistedEvent): void {
    for (const send of subscribers.get(event.runId) ?? []) send(event);
  }

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

function toEventDto(event: Awaited<ReturnType<UnitOfWork["repositories"]["events"]["append"]>>): EventDto {
  return {
    id: event.id,
    type: event.type,
    summary: event.summary,
    cursor: event.cursor,
    createdAt: event.createdAt
  };
}

type PersistedEvent = Awaited<ReturnType<UnitOfWork["repositories"]["events"]["append"]>>;

function formatSse(event: PersistedEvent): string {
  return [
    `id: ${event.cursor}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(toEventDto(event))}`,
    "",
    ""
  ].join("\n");
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
