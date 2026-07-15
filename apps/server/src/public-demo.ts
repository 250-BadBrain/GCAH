import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { MockLlmClient } from "@gcah/llm";

import { PublicDemoRateLimit } from "./rate-limit.js";

export interface PublicDemoExample {
  id: string;
  title: string;
  task: string;
}

export interface CreatePublicDemoAppOptions {
  examples: readonly PublicDemoExample[];
  maxRunsPerClient?: number;
}

export function createPublicDemoApp(options: CreatePublicDemoAppOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  const limiter = new PublicDemoRateLimit(options.maxRunsPerClient ?? 20);
  const examples = new Map(options.examples.map((example) => [example.id, example]));
  const mockLlm = new MockLlmClient([{
    response: { kind: "finish", summary: "public demo preset", rationale: "mock only" },
    usage: null
  }]);

  app.get("/api/public-demo/examples", async () => ({
    examples: options.examples.map(({ id, title }) => ({ id, title }))
  }));

  app.post("/api/public-demo/runs", async (request, reply) => {
    const body = request.body;
    if (!isRecord(body) || typeof body.exampleId !== "string" || Object.keys(body).some((key) => key !== "exampleId")) {
      return reply.code(403).send({ error: "PUBLIC_DEMO_CAPABILITY_DENIED" });
    }
    const example = examples.get(body.exampleId);
    if (example === undefined) return reply.code(403).send({ error: "PUBLIC_DEMO_CAPABILITY_DENIED" });
    const client = request.ip;
    if (!limiter.allow(client)) return reply.code(429).send({ error: "PUBLIC_DEMO_RATE_LIMITED" });
    await mockLlm.complete([{ role: "user", content: example.task }]);
    return reply.code(201).send({
      runId: `demo-run:${randomUUID()}`,
      mode: "public-demo",
      llmProvider: "mock",
      workspace: "resettable-demo-workspace"
    });
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.includes("credential") || request.url.includes("upload")) {
      return reply.code(403).send({ error: "PUBLIC_DEMO_CAPABILITY_DENIED" });
    }
  });

  return app;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
