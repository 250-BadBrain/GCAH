import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";

import { createDemoWebApp, demoWebScenarios } from "../src/demo-web-app.js";
import { startDemoHarnessRun } from "../src/demo-web-harness.js";

describe("demo web launcher app", () => {
  it("serves WebUI and rejects public-demo capability escalation fields", async () => {
    const app = await createDemoWebApp({ distDir: await webuiFixture(), sseIdleTimeoutMs: 5 });

    await expect(app.inject({ method: "GET", url: "/" })).resolves.toMatchObject({ statusCode: 200 });
    await expect(app.inject({ method: "GET", url: "/health" })).resolves.toMatchObject({ statusCode: 200 });

    const examples = await app.inject({ method: "GET", url: "/api/public-demo/examples" });
    expect(examples.body).toContain("COMPLETE_SUCCESS");
    for (const scenario of demoWebScenarios) {
      expect("events" in scenario).toBe(false);
      expect("steps" in scenario).toBe(false);
      expect("actions" in scenario).toBe(false);
      expect("validations" in scenario).toBe(false);
      expect("approval" in scenario).toBe(false);
    }

    for (const forbidden of [
      { exampleId: "successful-agent-run", apiKey: "sk-demo-web-sentinel" },
      { workspacePath: "E:/Desktop/GCAH", task: "touch real project" },
      { exampleId: "successful-agent-run", command: "pnpm install" },
      { exampleId: "successful-agent-run", network: "https://example.com" },
      { upload: "file" }
    ]) {
      const response = await app.inject({ method: "POST", url: "/api/public-demo/runs", payload: forbidden });
      expect(response.statusCode).toBe(403);
      expect(response.body).not.toContain("sk-demo-web-sentinel");
    }

    await app.close();
  });

  it("creates a run through the real AgentLoop and reads SSE events from persisted repositories", async () => {
    const onAgentLoopStart = vi.fn();
    const app = await createDemoWebApp({ distDir: await webuiFixture(), sseIdleTimeoutMs: 5, onAgentLoopStart });

    const created = await app.inject({ method: "POST", url: "/api/public-demo/runs", payload: { exampleId: "successful-agent-run" } });
    expect(created.statusCode).toBe(201);
    const body = JSON.parse(created.body) as { runId: string };
    expect(onAgentLoopStart).toHaveBeenCalledWith({ scenarioId: "successful-agent-run", runId: body.runId });

    const run = await app.inject({ method: "GET", url: `/api/runs/${body.runId}` });
    expect(run.body).toContain("COMPLETED");

    const files = await app.inject({ method: "GET", url: `/api/runs/${body.runId}/files` });
    expect(files.body).toContain("broken");
    expect(files.body).toContain("fixed");

    const events = await app.inject({ method: "GET", url: `/api/runs/${body.runId}/events?cursor=0` });
    expect(events.body).toContain("action.proposed");
    expect(events.body).toContain("tool.result");
    expect(events.body).toContain("validation.fail");
    expect(events.body).toContain("validation.pass");
    expect(events.body).toContain("run.completed");

    const stream = await app.inject({ method: "GET", url: `/api/runs/${body.runId}/events/stream?cursor=0` });
    expect(stream.headers["content-type"]).toContain("text/event-stream");
    expect(stream.body).toContain("validation.fail");

    await app.close();
  });

  it("uses validation feedback to change the next Mock LLM action and mutate the workspace", async () => {
    const scenario = demoWebScenarios.find((item) => item.id === "successful-agent-run");
    expect(scenario).toBeDefined();
    const harness = await startDemoHarnessRun(scenario!);
    const appFile = harness.afterFiles["src/app.ts"];
    expect(harness.beforeFiles["src/app.ts"]).toContain("broken");
    expect(appFile).toContain("fixed");

    const messagesAfterFailure = JSON.stringify(harness.mockLlm.requests[2]);
    expect(messagesAfterFailure).toContain("Validation failed");

    const steps = await harness.unitOfWork.repositories.steps.listByRun(harness.run.id);
    const actions = (await Promise.all(steps.map(async (step) => harness.unitOfWork.repositories.actions.listByStep(step.id)))).flat();
    expect(actions.map((action) => action.toolName)).toEqual(["read", "patch", null, "patch", null]);
    expect(JSON.stringify(actions[1]?.args)).not.toEqual(JSON.stringify(actions[3]?.args));
  });

  it("generates DENY through real governance policy and pauses approval runs until approved", async () => {
    const app = await createDemoWebApp({ distDir: await webuiFixture(), sseIdleTimeoutMs: 5 });

    const denied = await app.inject({ method: "POST", url: "/api/public-demo/runs", payload: { exampleId: "dangerous-denied" } });
    const deniedBody = JSON.parse(denied.body) as { runId: string };
    const deniedEvents = await app.inject({ method: "GET", url: `/api/runs/${deniedBody.runId}/events?cursor=0` });
    expect(deniedEvents.body).toContain("governance.decision");
    expect(deniedEvents.body).toContain("DENY");
    expect(deniedEvents.body).toContain("DANGEROUS_ACTION_DENIED");

    const approval = await app.inject({ method: "POST", url: "/api/public-demo/runs", payload: { exampleId: "approval-required" } });
    const approvalBody = JSON.parse(approval.body) as { runId: string };
    await expect(app.inject({ method: "GET", url: `/api/runs/${approvalBody.runId}` })).resolves.toMatchObject({ body: expect.stringContaining("WAITING_APPROVAL") });

    const approved = await app.inject({ method: "POST", url: `/api/runs/${approvalBody.runId}/approvals/action:finish` });
    expect(approved.statusCode).toBe(200);
    expect(approved.body).toContain("COMPLETED");

    await app.close();
  });
});

async function webuiFixture(): Promise<string> {
  const distDir = join(tmpdir(), `gcah-demo-web-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(distDir, { recursive: true });
  await writeFile(join(distDir, "index.html"), "<!doctype html><div id=\"root\"></div>");
  return distDir;
}
