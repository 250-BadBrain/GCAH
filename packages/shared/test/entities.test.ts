import { describe, expect, it } from "vitest";

import {
  ActionSchema,
  ApprovalRequestSchema,
  ConfigSnapshotSchema,
  CredentialStatusSchema,
  FeedbackSchema,
  GovernanceDecisionSchema,
  MemoryEntrySchema,
  RunEventSchema,
  RunSchema,
  SessionGrantSchema,
  StepSchema,
  ToolResultSchema,
  ValidationResultSchema,
  WorkspaceSchema,
  entitySchemas
} from "../src/entities.js";

const timestamp = "2026-07-13T00:00:00.000Z";

describe("entity schemas", () => {
  it("parses the required SPEC entity set", () => {
    expect(WorkspaceSchema.parse({
      id: "workspace-1",
      rootPath: "E:/example",
      allowedWorkspaceRoot: "E:/",
      executionBackend: "local",
      runMode: "local",
      createdAt: timestamp
    }).id).toBe("workspace-1");

    expect(RunSchema.parse({
      id: "run-1",
      workspaceId: "workspace-1",
      taskSummary: "make a change",
      status: "PENDING",
      configSnapshotId: "config-1",
      budgetUsage: { rounds: 0, tokens: 0, elapsedMs: 0, repeatedFailures: 0 },
      stopReason: null,
      stopDetail: null,
      createdAt: timestamp,
      updatedAt: timestamp
    }).status).toBe("PENDING");

    expect(RunSchema.parse({
      id: "run-budget",
      workspaceId: "workspace-1",
      taskSummary: "budget stopped",
      status: "STOPPED",
      configSnapshotId: "config-1",
      budgetUsage: { rounds: 5, tokens: 100, elapsedMs: 1000, repeatedFailures: 0 },
      stopReason: "BUDGET_EXHAUSTED",
      stopDetail: {
        kind: "rounds",
        limit: 5,
        used: 5,
        remaining: 0,
        observedAtStep: 5
      },
      createdAt: timestamp,
      updatedAt: timestamp
    }).stopReason).toBe("BUDGET_EXHAUSTED");

    expect(StepSchema.parse({
      id: "step-1",
      runId: "run-1",
      sequence: 1,
      contextSummary: "context",
      llmUsage: null,
      usageMissing: false,
      status: "PENDING",
      createdAt: timestamp,
      updatedAt: timestamp
    }).sequence).toBe(1);

    expect(ActionSchema.parse({
      id: "action-1",
      stepId: "step-1",
      kind: "tool",
      toolName: "read",
      finishSummary: null,
      args: { path: "README.md" },
      displayRationale: "read file",
      normalizedSummary: "read README.md",
      riskCategory: "low",
      status: "PROPOSED",
      createdAt: timestamp,
      updatedAt: timestamp
    }).toolName).toBe("read");

    expect(GovernanceDecisionSchema.parse({
      id: "decision-1",
      actionId: "action-1",
      result: "ALLOW",
      ruleId: "GOV-READ",
      riskCategory: "low",
      explanation: "safe read",
      createdAt: timestamp
    }).result).toBe("ALLOW");

    expect(ApprovalRequestSchema.parse({
      id: "approval-1",
      actionId: "action-1",
      normalizedActionHash: "hash-1",
      actionSummary: "write file",
      status: "PENDING",
      createdAt: timestamp,
      expiresAt: timestamp,
      decidedAt: null,
      humanReason: null
    }).status).toBe("PENDING");

    expect(SessionGrantSchema.parse({
      id: "grant-1",
      runId: "run-1",
      toolName: "patch",
      pathScope: "packages/shared",
      commandTemplate: null,
      riskCategory: "medium",
      scopeHash: "scope-1",
      expiresAtRound: 3,
      grantedBy: "human",
      createdAt: timestamp
    }).toolName).toBe("patch");

    expect(ToolResultSchema.parse({
      id: "tool-result-1",
      actionId: "action-1",
      status: "OK",
      exitCode: 0,
      toolErrorCode: null,
      stdout: "ok",
      stderr: "",
      durationMs: 12,
      sideEffectSummary: "read-only",
      createdAt: timestamp
    }).status).toBe("OK");

    expect(ValidationResultSchema.parse({
      id: "validation-1",
      actionId: "action-1",
      type: "test",
      commandSnapshot: "pnpm test",
      result: "PASS",
      failureCategory: null,
      failureFingerprint: null,
      diagnosticSummary: null,
      durationMs: 100,
      createdAt: timestamp
    }).result).toBe("PASS");

    expect(FeedbackSchema.parse({
      id: "feedback-1",
      sourceId: "validation-1",
      sourceType: "validation",
      category: "validation_failed",
      summary: "tests failed",
      injected: false,
      createdAt: timestamp
    }).injected).toBe(false);

    expect(MemoryEntrySchema.parse({
      id: "memory-1",
      workspaceId: "workspace-1",
      type: "project_constraint",
      tags: ["policy"],
      keywords: ["workspace"],
      sourceRunId: "run-1",
      summary: "stay in workspace",
      createdAt: timestamp
    }).tags).toEqual(["policy"]);

    expect(RunEventSchema.parse({
      id: "event-1",
      runId: "run-1",
      stepId: "step-1",
      type: "action.proposed",
      relatedEntityId: "action-1",
      summary: "action proposed",
      cursor: 1,
      createdAt: timestamp
    }).cursor).toBe(1);

    expect(ConfigSnapshotSchema.parse({
      id: "config-1",
      schemaVersion: 1,
      allowedWorkspaceRoots: ["E:/Desktop"],
      nonSensitiveConfig: { maxRounds: 5 },
      contentHash: "config-hash",
      createdAt: timestamp
    }).schemaVersion).toBe(1);

    expect(CredentialStatusSchema.parse({
      provider: "openai-compatible",
      configured: false,
      sourceType: "os",
      updatedAt: null
    }).configured).toBe(false);
  });

  it("rejects secret-shaped fields from every persisted entity schema", () => {
    const forbidden = ["apiKey", "secret", "plaintext", "rawStack", "browserSecret"];

    for (const schema of Object.values(entitySchemas)) {
      const keys = JSON.stringify(schema.def);
      for (const key of forbidden) {
        expect(keys).not.toContain(`"${key}"`);
      }
    }
  });

  it("enforces run terminal status and stop reason invariants", () => {
    const baseRun = {
      id: "run-invalid",
      workspaceId: "workspace-1",
      taskSummary: "invalid state",
      configSnapshotId: "config-1",
      budgetUsage: { rounds: 0, tokens: 0, elapsedMs: 0, repeatedFailures: 0 },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    expect(() => RunSchema.parse({
      ...baseRun,
      status: "COMPLETED",
      stopReason: null,
      stopDetail: null
    })).toThrow();
    expect(() => RunSchema.parse({
      ...baseRun,
      status: "STOPPED",
      stopReason: "COMPLETED",
      stopDetail: null
    })).toThrow();
    expect(() => RunSchema.parse({
      ...baseRun,
      status: "STOPPED",
      stopReason: "BUDGET_EXHAUSTED",
      stopDetail: null
    })).toThrow();
    expect(() => RunSchema.parse({
      ...baseRun,
      status: "WAITING_APPROVAL",
      stopReason: "APPROVAL_REJECTED",
      stopDetail: null
    })).toThrow();
  });

  it("rejects raw rationale and unbounded tool output in persisted entities", () => {
    expect(() => ActionSchema.parse({
      id: "action-secret",
      stepId: "step-1",
      kind: "tool",
      toolName: "read",
      finishSummary: null,
      args: { path: "README.md" },
      rationale: "raw sk-test-secret",
      normalizedSummary: "read README.md",
      riskCategory: "low",
      status: "PROPOSED",
      createdAt: timestamp,
      updatedAt: timestamp
    })).toThrow();

    expect(() => ToolResultSchema.parse({
      id: "tool-result-long",
      actionId: "action-1",
      status: "OK",
      exitCode: 0,
      toolErrorCode: null,
      stdout: "x".repeat(4097),
      stderr: "",
      durationMs: 12,
      sideEffectSummary: "read-only",
      createdAt: timestamp
    })).toThrow();
    expect(() => ToolResultSchema.parse({
      id: "tool-result-token",
      actionId: "action-1",
      status: "OK",
      exitCode: 0,
      toolErrorCode: null,
      stdout: "Authorization: Bearer token-value",
      stderr: "",
      durationMs: 12,
      sideEffectSummary: "read-only",
      createdAt: timestamp
    })).toThrow();
    expect(() => ToolResultSchema.parse({
      id: "tool-result-path",
      actionId: "action-1",
      status: "OK",
      exitCode: 0,
      toolErrorCode: null,
      stdout: "C:/Users/Alice/.ssh/id_rsa",
      stderr: "",
      durationMs: 12,
      sideEffectSummary: "read-only",
      createdAt: timestamp
    })).toThrow();
  });

  it("enforces action kind, tool name, finish summary, and strict params", () => {
    const baseAction = {
      id: "action-invalid",
      stepId: "step-1",
      displayRationale: "safe",
      normalizedSummary: "summary",
      riskCategory: "low",
      status: "PROPOSED",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    expect(() => ActionSchema.parse({
      ...baseAction,
      kind: "tool",
      toolName: null,
      finishSummary: null,
      args: { path: "README.md" }
    })).toThrow();
    expect(() => ActionSchema.parse({
      ...baseAction,
      kind: "tool",
      toolName: "network_fetch",
      finishSummary: null,
      args: {}
    })).toThrow();
    expect(() => ActionSchema.parse({
      ...baseAction,
      kind: "tool",
      toolName: "read",
      finishSummary: "done",
      args: { path: "README.md" }
    })).toThrow();
    expect(() => ActionSchema.parse({
      ...baseAction,
      kind: "tool",
      toolName: "read",
      finishSummary: null,
      args: {}
    })).toThrow();
    expect(() => ActionSchema.parse({
      ...baseAction,
      kind: "tool",
      toolName: "patch",
      finishSummary: null,
      args: { path: "README.md" }
    })).toThrow();
    expect(() => ActionSchema.parse({
      ...baseAction,
      kind: "finish",
      toolName: "read",
      finishSummary: "done",
      args: {}
    })).toThrow();
    expect(() => ActionSchema.parse({
      ...baseAction,
      kind: "finish",
      toolName: null,
      finishSummary: "done",
      args: { path: "README.md" }
    })).toThrow();
  });

  it("rejects session grants for unknown tools", () => {
    expect(() => SessionGrantSchema.parse({
      id: "grant-bad",
      runId: "run-1",
      toolName: "network_fetch",
      pathScope: null,
      commandTemplate: null,
      riskCategory: "high",
      scopeHash: "scope-1",
      expiresAtRound: 3,
      grantedBy: "human",
      createdAt: timestamp
    })).toThrow();
  });
});
