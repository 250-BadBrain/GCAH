import type { Action, ConfigSnapshot, Run, RunEvent, Step, ToolRequest } from "@gcah/shared";
import type { BudgetStopDetail } from "@gcah/shared";

import { BudgetTracker, type BudgetLimits } from "../budget/budget.js";
import type { Clock } from "../ports/clock.js";
import type { LlmClientPort } from "../ports/llm-client.js";
import type { UnitOfWork } from "../ports/repositories.js";
import type { ToolGatewayPort } from "../ports/tool-gateway.js";
import type { ValidationRunner } from "../ports/validation-runner.js";
import { transitionRun } from "../state/run-machine.js";
import { FeedbackQueue } from "../validation/feedback.js";
import { ValidationService } from "../validation/validator.js";
import { buildLoopContext } from "./context-builder.js";
import { evaluateCompletion, parseAgentResponse, type MutationValidationState } from "./completion-gate.js";

export interface AgentLoopDependencies {
  clock: Clock;
  unitOfWork: UnitOfWork;
  llm: LlmClientPort;
  toolGateway: ToolGatewayPort;
  validationRunner: ValidationRunner;
}

export interface AgentLoopStartInput {
  runId: string;
  workspaceId: string;
  taskSummary: string;
  configSnapshot: ConfigSnapshot;
  maxSteps: number;
}

const MUTATION_TOOLS = new Set<ToolRequest["tool"]>(["write", "patch", "delete", "run_command"]);

export class AgentLoop {
  private readonly feedback = new FeedbackQueue();
  private readonly validation: ValidationService;

  constructor(private readonly deps: AgentLoopDependencies) {
    this.validation = new ValidationService(deps.validationRunner);
  }

  async start(input: AgentLoopStartInput): Promise<Run> {
    const budgets = readBudgetLimits(input.configSnapshot);
    const tracker = new BudgetTracker(budgets, this.deps.clock);
    let mutationValidation: MutationValidationState = "none";
    let run = await this.createRun(input);

    for (let sequence = 1; sequence <= input.maxSteps; sequence += 1) {
      const roundStop = tracker.recordRound(sequence);
      if (roundStop !== null) return this.stop(run, roundStop.reason, roundStop.detail);

      const feedback = this.feedback.consumeOnce();
      const context = buildLoopContext({
        taskSummary: input.taskSummary,
        configSnapshot: input.configSnapshot,
        memories: [],
        feedback,
        budget: tracker.snapshot(),
        maxChars: 4000
      });
      const step = await this.createStep(run.id, sequence, context.summary);
      const llmResult = await this.deps.llm.complete(context.messages);
      const usageResult = tracker.recordUsage(llmResult.usage, sequence);
      run = await this.updateBudgetUsage(run, tracker);
      if (usageResult?.reason === "USAGE_UNAVAILABLE") {
        await this.appendEvent(run.id, step.id, usageResult.event.type, usageResult.event.summary);
      } else if (usageResult?.reason === "BUDGET_EXHAUSTED") {
        return this.stop(run, usageResult.reason, usageResult.detail);
      }

      const parsed = parseAgentResponse(llmResult.response, tracker, sequence);
      if (parsed.kind === "retry") {
        await this.appendEvent(run.id, step.id, "llm.protocol_retry", parsed.diagnostics);
        continue;
      }
      if (parsed.kind === "stop") return this.stop(run, parsed.reason);

      if (parsed.response.kind === "finish") {
        const decision = evaluateCompletion({
          finish: parsed.response,
          pendingApproval: false,
          mutationValidation,
          budgetStop: null
        });
        if (decision.allowed) {
          run = transitionRun(run, { id: `complete:${sequence}`, type: "complete", at: this.deps.clock.nowIso() });
          await this.deps.unitOfWork.repositories.runs.update(run);
          await this.appendEvent(run.id, step.id, "run.completed", parsed.response.summary);
          return run;
        }
        await this.appendEvent(run.id, step.id, "finish.blocked", decision.reason);
        continue;
      }

      const action = await this.persistToolAction(run.id, step.id, sequence, parsed.response);
      const toolResult = await this.deps.toolGateway.execute({ tool: parsed.response.tool, args: parsed.response.args });
      await this.appendEvent(run.id, step.id, "tool.result", toolResult.summary, action.id);
      if (toolResult.status === "ERROR") return this.stop(run, "POLICY_DENIED");

      if (MUTATION_TOOLS.has(parsed.response.tool)) {
        const request: ToolRequest = {
          id: `tool-request:${action.id}`,
          runId: run.id,
          actionId: action.id,
          tool: parsed.response.tool,
          args: parsed.response.args
        } as ToolRequest;
        const validation = await this.validation.validate(request, input.configSnapshot);
        mutationValidation = validation.readyToComplete ? "passed" : "failed";
        for (const result of validation.results) {
          this.feedback.enqueueValidation(result);
          await this.appendEvent(run.id, step.id, `validation.${result.result.toLowerCase()}`, result.diagnosticSummary ?? result.result, result.id);
          if (result.failureFingerprint !== null) {
            const repeated = tracker.recordFailureFingerprint(result.failureFingerprint, sequence);
            if (repeated !== null) return this.stop(run, repeated.reason);
          }
        }
        if (validation.results.length === 0) mutationValidation = "passed";
      }
    }

    return this.stop(run, "BUDGET_EXHAUSTED", {
      kind: "rounds",
      limit: input.maxSteps,
      used: input.maxSteps,
      remaining: 0,
      observedAtStep: input.maxSteps
    });
  }

  async continueAfterApproval(runId: string): Promise<Run | null> {
    return this.deps.unitOfWork.repositories.runs.getById(runId);
  }

  async cancel(runId: string): Promise<Run | null> {
    const run = await this.deps.unitOfWork.repositories.runs.getById(runId);
    if (run === null) return null;
    const next = transitionRun(run, { id: `cancel:${this.deps.clock.nowIso()}`, type: "cancel", at: this.deps.clock.nowIso() });
    return this.deps.unitOfWork.repositories.runs.update(next);
  }

  private async createRun(input: AgentLoopStartInput): Promise<Run> {
    const at = this.deps.clock.nowIso();
    const run: Run = {
      id: input.runId,
      workspaceId: input.workspaceId,
      taskSummary: input.taskSummary,
      status: "PENDING",
      configSnapshotId: input.configSnapshot.id,
      budgetUsage: { rounds: 0, tokens: 0, elapsedMs: 0, repeatedFailures: 0 },
      transitionIds: [],
      stopReason: null,
      stopDetail: null,
      createdAt: at,
      updatedAt: at
    };
    await this.deps.unitOfWork.repositories.config.createSnapshot(input.configSnapshot);
    const created = await this.deps.unitOfWork.repositories.runs.create(run);
    const started = transitionRun(created, { id: "start:1", type: "start", at: this.deps.clock.nowIso() });
    await this.deps.unitOfWork.repositories.runs.update(started);
    await this.appendEvent(started.id, null, "run.started", input.taskSummary);
    return started;
  }

  private async createStep(runId: string, sequence: number, contextSummary: string): Promise<Step> {
    const at = this.deps.clock.nowIso();
    return this.deps.unitOfWork.repositories.steps.create({
      id: `step:${runId}:${sequence}`,
      runId,
      sequence,
      contextSummary,
      llmUsage: null,
      usageMissing: false,
      status: "COMPLETED",
      createdAt: at,
      updatedAt: at
    });
  }

  private async updateBudgetUsage(run: Run, tracker: BudgetTracker): Promise<Run> {
    const snapshot = tracker.snapshot();
    const next = {
      ...run,
      budgetUsage: {
        rounds: snapshot.rounds,
        tokens: snapshot.tokens,
        elapsedMs: snapshot.elapsedMs,
        repeatedFailures: snapshot.repeatedFailures
      },
      updatedAt: this.deps.clock.nowIso()
    };
    return this.deps.unitOfWork.repositories.runs.update(next);
  }

  private async persistToolAction(runId: string, stepId: string, sequence: number, response: Extract<import("@gcah/shared").AgentResponse, { kind: "tool" }>): Promise<Action> {
    const at = this.deps.clock.nowIso();
    const action = {
      id: `action:${runId}:${sequence}`,
      stepId,
      kind: "tool",
      toolName: response.tool,
      args: response.args,
      finishSummary: null,
      displayRationale: response.rationale.slice(0, 2048),
      normalizedSummary: `${response.tool} action`,
      riskCategory: "unknown",
      status: "PROPOSED",
      transitionIds: [],
      createdAt: at,
      updatedAt: at
    } as unknown as Action;
    const persisted = await this.deps.unitOfWork.repositories.actions.create(action);
    await this.appendEvent(runId, stepId, "action.proposed", persisted.normalizedSummary, persisted.id);
    return persisted;
  }

  private async stop(run: Run, reason: "BUDGET_EXHAUSTED" | "POLICY_DENIED" | "REPEATED_FAILURE" | "PROTOCOL_ERROR", detail?: BudgetStopDetail): Promise<Run> {
    const transition = reason === "BUDGET_EXHAUSTED"
      ? { id: `stop:${reason}:${this.deps.clock.nowIso()}`, type: "stop" as const, reason, detail: detail ?? { kind: "rounds" as const, limit: 0, used: 0, remaining: 0, observedAtStep: 0 }, at: this.deps.clock.nowIso() }
      : { id: `stop:${reason}:${this.deps.clock.nowIso()}`, type: "stop" as const, reason, at: this.deps.clock.nowIso() };
    const next = transitionRun(run, transition);
    await this.deps.unitOfWork.repositories.runs.update(next);
    await this.appendEvent(next.id, null, "run.stopped", reason);
    return next;
  }

  private async appendEvent(runId: string, stepId: string | null, type: string, summary: string, relatedEntityId: string | null = null): Promise<RunEvent> {
    return this.deps.unitOfWork.repositories.events.append({
      id: `event:${runId}:${type}:${this.deps.clock.nowIso()}`,
      runId,
      stepId,
      type,
      relatedEntityId,
      summary,
      createdAt: this.deps.clock.nowIso()
    });
  }
}

function readBudgetLimits(configSnapshot: ConfigSnapshot): BudgetLimits {
  const config = configSnapshot.nonSensitiveConfig as { budgets?: { maxRounds?: number; maxTokens?: number; maxElapsedMs?: number } };
  return {
    maxRounds: config.budgets?.maxRounds ?? 10,
    maxTokens: config.budgets?.maxTokens ?? 100000,
    maxElapsedMs: config.budgets?.maxElapsedMs ?? 3600000,
    repeatedFailureLimit: 3,
    maxProtocolRetries: 3
  };
}
