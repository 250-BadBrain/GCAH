import { describe, expect, it } from "vitest";

import { createConfigSnapshot, loadConfig } from "../src/index.js";
import type { WorkspaceFencePort } from "../src/index.js";

class FakeFence implements WorkspaceFencePort {
  constructor(private readonly ok: boolean) {}
  async validateWorkspace(): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
    return this.ok ? { ok: true } : { ok: false, code: "BAD_ROOT", message: "bad root" };
  }
  async resolveExistingTarget(path: string): Promise<{ ok: true; absolutePath: string } | { ok: false; code: string; message: string }> {
    return { ok: true, absolutePath: path };
  }
  async resolveNewTarget(path: string): Promise<{ ok: true; absolutePath: string } | { ok: false; code: string; message: string }> {
    return { ok: true, absolutePath: path };
  }
}

describe("configuration", () => {
  it("loads defaults, project yaml, and CLI overrides with immutable snapshots", async () => {
    const projectConfigText = [
      "mode: local",
      "budgets:",
      "  maxRounds: 4",
      "validation:",
      "  required: [test]",
      "riskThresholds:",
      "  requireApproval: medium",
      "  deny: high",
      "commands:",
      "  test: pnpm test"
    ].join("\n");
    const config = await loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: { budgets: { maxTokens: 123 } },
      environmentMetadata: { llmProvider: "mock" },
      workspaceFence: new FakeFence(true),
      projectConfigText
    });
    expect(config.budgets).toMatchObject({ maxRounds: 4, maxTokens: 123 });
    expect(config.validation.required).toEqual(["test"]);

    const snapshot = createConfigSnapshot(config);
    expect(snapshot.contentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(snapshot.nonSensitiveConfig.riskThresholds).toEqual({ requireApproval: "medium", deny: "high" });
    expect(() => {
      snapshot.nonSensitiveConfig.mode = "other";
    }).toThrow();
  });

  it("preserves configured allowed roots according to project and CLI precedence", async () => {
    await expect(loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: { allowedWorkspaceRoots: ["E:/cli"] },
      environmentMetadata: {},
      workspaceFence: new FakeFence(true),
      projectConfigText: "allowedWorkspaceRoots: [E:/project]\n"
    })).resolves.toMatchObject({
      allowedWorkspaceRoots: ["E:/cli"]
    });
  });

  it("rejects unknown fields, secret fields, invalid budgets, bad roots, and missing validators", async () => {
    await expect(loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: {},
      environmentMetadata: {},
      workspaceFence: new FakeFence(true),
      projectConfigText: "apiKey: secret\n"
    })).rejects.toThrow(/secret/i);

    await expect(loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: {},
      environmentMetadata: {},
      workspaceFence: new FakeFence(true),
      projectConfigText: "commands:\n  test: OPENAI_API_KEY=sk-test pnpm test\n"
    })).rejects.toThrow(/secret/i);

    await expect(loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: { commands: { test: "pnpm test --token sk-test" } },
      environmentMetadata: {},
      workspaceFence: new FakeFence(true),
      projectConfigText: ""
    })).rejects.toThrow(/secret/i);

    await expect(loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: {},
      environmentMetadata: {},
      workspaceFence: new FakeFence(true),
      projectConfigText: "unknown: true\n"
    })).rejects.toThrow(/unknown/i);

    await expect(loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: {},
      environmentMetadata: {},
      workspaceFence: new FakeFence(true),
      projectConfigText: "budgets:\n  maxRounds: 0\n"
    })).rejects.toThrow(/budget/i);

    await expect(loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: {},
      environmentMetadata: {},
      workspaceFence: new FakeFence(true),
      projectConfigText: "validation:\n  required: [test]\n"
    })).rejects.toThrow(/validation command/i);

    await expect(loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: {},
      environmentMetadata: {},
      workspaceFence: new FakeFence(false),
      projectConfigText: "mode: local\n"
    })).rejects.toThrow(/workspace/i);
  });

  it("creates deterministic SHA-256 snapshots for distinct non-secret config", async () => {
    const first = await loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: {},
      environmentMetadata: {},
      workspaceFence: new FakeFence(true),
      projectConfigText: "mode: local\n"
    });
    const second = await loadConfig({
      workspaceRoot: "E:/workspace",
      cliOverrides: { budgets: { maxRounds: 11 } },
      environmentMetadata: {},
      workspaceFence: new FakeFence(true),
      projectConfigText: "mode: local\n"
    });
    expect(createConfigSnapshot(first).contentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(createConfigSnapshot(first).contentHash).toBe(createConfigSnapshot(first).contentHash);
    expect(createConfigSnapshot(first).contentHash).not.toBe(createConfigSnapshot(second).contentHash);
  });
});
