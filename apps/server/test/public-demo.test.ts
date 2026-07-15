import { describe, expect, it, vi } from "vitest";

import { createPublicDemoApp } from "../src/public-demo.js";

describe("public demo mode", () => {
  it("exposes only fixed examples and rejects arbitrary workspaces, uploads, credentials, real LLM, shell, installs, and network", async () => {
    const app = createPublicDemoApp({
      examples: [{ id: "safe-patch", title: "Safe patch", task: "Apply a fixed patch" }]
    });

    const examples = await app.inject({ method: "GET", url: "/api/public-demo/examples" });
    expect(examples.statusCode).toBe(200);
    expect(examples.body).toContain("safe-patch");

    const accepted = await app.inject({ method: "POST", url: "/api/public-demo/runs", payload: { exampleId: "safe-patch" } });
    expect(accepted.statusCode).toBe(201);
    expect(accepted.body).not.toContain("sk-public-demo-sentinel");

    for (const payload of [
      { workspacePath: "E:/Desktop/GCAH", task: "arbitrary" },
      { exampleId: "safe-patch", apiKey: "sk-public-demo-sentinel" },
      { exampleId: "safe-patch", llmProvider: "openai-compatible" },
      { exampleId: "safe-patch", command: "pnpm install" },
      { exampleId: "safe-patch", network: "https://example.com" },
      { upload: "file-content" }
    ]) {
      const rejected = await app.inject({ method: "POST", url: "/api/public-demo/runs", payload });
      expect(rejected.statusCode).toBe(403);
      expect(rejected.body).not.toContain("sk-public-demo-sentinel");
    }

    await app.close();
  });

  it("does not spawn processes or use network transport", async () => {
    const processSpy = vi.spyOn(process, "emit");
    const app = createPublicDemoApp({
      examples: [{ id: "safe-patch", title: "Safe patch", task: "Apply a fixed patch" }]
    });

    await app.inject({ method: "POST", url: "/api/public-demo/runs", payload: { exampleId: "safe-patch" } });

    expect(processSpy).not.toHaveBeenCalledWith("spawn" as never);
    await app.close();
    processSpy.mockRestore();
  });
});
