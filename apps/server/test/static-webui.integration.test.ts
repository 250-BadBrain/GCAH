import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { createServerApp } from "../src/app.js";
import { registerStaticWebui } from "../src/static-webui.js";
import { createInMemoryRepositories } from "@gcah/persistence";
import type { Clock } from "@gcah/core";

const clock: Clock = {
  now: () => new Date("2026-07-14T10:00:00.000Z"),
  nowIso: () => "2026-07-14T10:00:00.000Z"
};

describe("static WebUI hosting", () => {
  it("serves WebUI assets and SPA fallback without intercepting API or SSE paths", async () => {
    const dist = join(tmpdir(), `gcah-webui-${Date.now()}`);
    await mkdir(join(dist, "assets"), { recursive: true });
    await writeFile(join(dist, "index.html"), "<!doctype html><div id=\"root\"></div>");
    await writeFile(join(dist, "assets", "index-abc.js"), "console.log('asset');");
    const app = createServerApp({
      unitOfWork: createInMemoryRepositories(clock),
      clock,
      auth: { enabled: false },
      sseIdleTimeoutMs: 1
    });
    await registerStaticWebui(app, { distDir: dist });

    const root = await app.inject({ method: "GET", url: "/" });
    expect(root.statusCode).toBe(200);
    expect(root.headers["content-type"]).toContain("text/html");

    const asset = await app.inject({ method: "GET", url: "/assets/index-abc.js" });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers["cache-control"]).toContain("max-age=31536000");

    const spa = await app.inject({ method: "GET", url: "/runs/run-1" });
    expect(spa.statusCode).toBe(200);
    expect(spa.body).toContain("root");

    const api = await app.inject({ method: "GET", url: "/api/config/status" });
    expect(api.statusCode).toBe(200);
    expect(api.headers["content-type"]).toContain("application/json");

    const sse = await app.inject({ method: "GET", url: "/api/runs/run-1/events/stream" });
    expect(sse.headers["content-type"]).toContain("text/event-stream");

    await app.close();
  });
});
