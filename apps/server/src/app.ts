import Fastify, { type FastifyInstance } from "fastify";
import { CreateRunRequestSchema, type RunDto } from "@gcah/shared";
import type { Clock, UnitOfWork } from "@gcah/core";
import { cloneInterruptedRunAsPending, transitionRun } from "@gcah/core";

export interface ServerAuthOptions {
  enabled: boolean;
}

export interface CreateServerAppOptions {
  unitOfWork: UnitOfWork;
  clock: Clock;
  auth: ServerAuthOptions;
}

export function createServerApp(options: CreateServerAppOptions): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ ok: true }));

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
