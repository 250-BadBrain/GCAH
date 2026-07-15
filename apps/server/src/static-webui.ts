import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { access } from "node:fs/promises";
import { join } from "node:path";

export interface StaticWebuiOptions {
  distDir: string;
}

export async function registerStaticWebui(app: FastifyInstance, options: StaticWebuiOptions): Promise<void> {
  const indexPath = join(options.distDir, "index.html");
  await access(indexPath);
  await app.register(fastifyStatic, {
    root: options.distDir,
    prefix: "/",
    maxAge: "1y",
    immutable: true
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.method !== "GET" || request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    return reply.type("text/html; charset=utf-8").sendFile("index.html");
  });
}
