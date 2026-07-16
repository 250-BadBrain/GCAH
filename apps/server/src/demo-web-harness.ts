import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { AgentLoop, createConfigSnapshot, type Clock, type ValidationRunner } from "@gcah/core";
import { createInMemoryRepositories } from "@gcah/persistence";
import { ApprovalService, createGovernanceEngine, createWorkspaceFence } from "@gcah/governance";
import { createToolGateway, LocalExecutor, registerMutationTools, registerReadTools } from "@gcah/tools";
import { MockLlmClient } from "@gcah/llm";
import type { ConfigSnapshot, Run, ValidationResult } from "@gcah/shared";

import type { DemoWebScenario } from "./demo-web-fixtures.js";

export interface DemoHarnessRun {
  run: Run;
  workspaceRoot: string;
  beforeFiles: Record<string, string>;
  afterFiles: Record<string, string>;
  unitOfWork: ReturnType<typeof createInMemoryRepositories>;
  loop: AgentLoop;
  mockLlm: MockLlmClient;
}

export interface DemoHarnessOptions {
  clock?: Clock;
  onAgentLoopStart?: (input: { scenarioId: string; runId: string }) => void;
}

export class DemoClock implements Clock {
  private ticks = 0;
  now(): Date {
    this.ticks += 1;
    return new Date(Date.UTC(2026, 6, 14, 0, 0, this.ticks));
  }
  nowIso(): string {
    return this.now().toISOString();
  }
}

export async function startDemoHarnessRun(scenario: DemoWebScenario, options: DemoHarnessOptions = {}): Promise<DemoHarnessRun> {
  const clock = options.clock ?? new DemoClock();
  const workspaceRoot = await mkdtemp(join(tmpdir(), "gcah-demo-workspace-"));
  await seedWorkspace(workspaceRoot, scenario.files);
  const beforeFiles = await readScenarioFiles(workspaceRoot, scenario.files);
  const baseSha256 = sha256(beforeFiles["src/app.ts"] ?? "");
  const almostSha256 = sha256("export const value = \"almost\";\n");
  const script = scenario.script({ baseSha256, almostSha256 });
  const unitOfWork = createInMemoryRepositories(clock);
  const mockLlm = new MockLlmClient(script);
  const validationRunner = new WorkspaceDemoValidationRunner(workspaceRoot, clock);
  const executor = new LocalExecutor({
    workspaceRoot,
    fence: createWorkspaceFence({ allowedWorkspaceRoots: [workspaceRoot], workspaceRoot, protectedRoots: [] })
  });
  registerReadTools(executor);
  registerMutationTools(executor);
  executor.registry.register({
    tool: "run_command",
    execute: async () => ({ status: "ERROR" as const, summary: "PUBLIC_DEMO_SHELL_DISABLED" })
  });

  const approvalService = new ApprovalService();
  let finishPaused = false;
  let finishApproved = false;
  const runId = `demo-run:${scenario.id}:${randomUUID()}`;
  const toolGateway = createToolGateway({
    runId,
    actionIdFactory: () => `gateway-action:${randomUUID()}`,
    unitOfWork,
    governance: createGovernanceEngine(),
    approval: {
      authorize: (input) => approvalService.authorize(input)
    },
    registry: executor.registry
  });
  const loop = new AgentLoop({
    clock,
    unitOfWork,
    llm: mockLlm,
    toolGateway,
    validationRunner,
    approval: {
      shouldPauseForFinish: () => {
        if (scenario.id !== "approval-required" || finishPaused || finishApproved) return false;
        finishPaused = true;
        return true;
      },
      consumeApproval: async () => {
        if (finishApproved) return "approved";
        return "pending";
      }
    }
  });
  const configSnapshot = demoConfig(workspaceRoot);
  options.onAgentLoopStart?.({ scenarioId: scenario.id, runId });
  const run = await loop.start({
    runId,
    workspaceId: workspaceRoot,
    taskSummary: scenario.task,
    configSnapshot,
    maxSteps: 8
  });
  const afterFiles = await readScenarioFiles(workspaceRoot, scenario.files);
  if (scenario.id === "approval-required") {
    approvalContinuations.set(runId, async () => {
      finishApproved = true;
      const resumed = await loop.continueAfterApproval(runId);
      return resumed ?? run;
    });
  }
  return { run, workspaceRoot, beforeFiles, afterFiles, unitOfWork, loop, mockLlm };
}

const approvalContinuations = new Map<string, () => Promise<Run>>();

export async function approveDemoRun(runId: string): Promise<Run | null> {
  const resume = approvalContinuations.get(runId);
  if (resume === undefined) return null;
  const run = await resume();
  approvalContinuations.delete(runId);
  return run;
}

async function seedWorkspace(workspaceRoot: string, files: Record<string, string>): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(workspaceRoot, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }
}

async function readScenarioFiles(workspaceRoot: string, files: Record<string, string>): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const relativePath of Object.keys(files)) {
    result[relativePath] = await readFile(join(workspaceRoot, relativePath), "utf8");
  }
  return result;
}

function demoConfig(workspaceRoot: string): ConfigSnapshot {
  return createConfigSnapshot({
    mode: "local",
    budgets: { maxRounds: 8, maxTokens: 10000, maxElapsedMs: 600000 },
    validation: { required: ["test"] },
    riskThresholds: { requireApproval: "medium", deny: "high" },
    commands: { test: "demo test" },
    allowedWorkspaceRoots: [workspaceRoot],
    executorBackend: "local",
    llm: { provider: "mock" }
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

class WorkspaceDemoValidationRunner implements ValidationRunner {
  constructor(
    private readonly workspaceRoot: string,
    private readonly clock: Clock
  ) {}

  async runValidator(validatorId: string, configSnapshot: ConfigSnapshot): Promise<ValidationResult> {
    void configSnapshot;
    const content = await readFile(join(this.workspaceRoot, "src", "app.ts"), "utf8").catch(() => "");
    const passed = content.includes("\"fixed\"");
    return {
      id: `validation:${validatorId}:${createHash("sha256").update(content).digest("hex").slice(0, 8)}`,
      actionId: "action-pending",
      type: validatorId === "test" || validatorId === "lint" || validatorId === "typecheck" || validatorId === "build" ? validatorId : "custom",
      commandSnapshot: `demo:${validatorId}`,
      result: passed ? "PASS" : "FAIL",
      failureCategory: passed ? null : "demo_validation",
      failureFingerprint: passed ? null : "demo-validation:not-fixed",
      diagnosticSummary: passed ? "demo validation passed" : "Expected src/app.ts to contain fixed",
      durationMs: 1,
      createdAt: this.clock.nowIso()
    };
  }
}
