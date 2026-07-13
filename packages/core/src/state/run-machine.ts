import type { BudgetStopDetail, Run, StopReason } from "@gcah/shared";

import { TransitionError } from "./transition-error.js";
import type { Clock, RunRepository } from "../index.js";

export type RunTransition =
  | { id: string; type: "start"; at: string }
  | { id: string; type: "wait_for_approval"; at: string }
  | { id: string; type: "complete"; at: string }
  | { id: string; type: "stop"; reason: Exclude<StopReason, "COMPLETED" | "UNFIXABLE_FAILURE" | "USER_CANCELLED" | "INTERRUPTED">; detail?: BudgetStopDetail; at: string }
  | { id: string; type: "fail"; at: string }
  | { id: string; type: "cancel"; at: string }
  | { id: string; type: "interrupt"; at: string };

function markTransition(run: Run, id: string): Run | null {
  if (run.transitionIds?.includes(id) === true) {
    return run;
  }
  return null;
}

function withTransition(source: Run, id: string, next: Run): Run {
  const seen = new Set(source.transitionIds ?? []);
  seen.add(id);
  return { ...next, transitionIds: [...seen] };
}

export function transitionRun(run: Run, transition: RunTransition): Run {
  const idempotent = markTransition(run, transition.id);
  if (idempotent !== null) {
    return idempotent;
  }
  if (["COMPLETED", "STOPPED", "FAILED", "INTERRUPTED", "CANCELLED"].includes(run.status)) {
    throw new TransitionError(`${run.status} run cannot transition`);
  }

  const base = { ...run, updatedAt: transition.at };
  switch (transition.type) {
    case "start":
      if (run.status !== "PENDING") throw new TransitionError("only PENDING can start");
      return withTransition(run, transition.id, { ...base, status: "RUNNING", stopReason: null, stopDetail: null });
    case "wait_for_approval":
      return withTransition(run, transition.id, { ...base, status: "WAITING_APPROVAL", stopReason: null, stopDetail: null });
    case "complete":
      return withTransition(run, transition.id, { ...base, status: "COMPLETED", stopReason: "COMPLETED", stopDetail: null });
    case "stop":
      if (!["BUDGET_EXHAUSTED", "POLICY_DENIED", "APPROVAL_REJECTED", "REPEATED_FAILURE", "PROTOCOL_ERROR"].includes(transition.reason)) {
        throw new TransitionError("invalid STOPPED reason");
      }
      if (transition.reason === "BUDGET_EXHAUSTED" && transition.detail === undefined) {
        throw new TransitionError("budget stop requires detail");
      }
      return withTransition(run, transition.id, { ...base, status: "STOPPED", stopReason: transition.reason, stopDetail: transition.detail ?? null });
    case "fail":
      return withTransition(run, transition.id, { ...base, status: "FAILED", stopReason: "UNFIXABLE_FAILURE", stopDetail: null });
    case "cancel":
      return withTransition(run, transition.id, { ...base, status: "CANCELLED", stopReason: "USER_CANCELLED", stopDetail: null });
    case "interrupt":
      return withTransition(run, transition.id, { ...base, status: "INTERRUPTED", stopReason: "INTERRUPTED", stopDetail: null });
  }
}

export function interruptRun(run: Run, transitionId: string, at: string): Run {
  return transitionRun(run, { id: transitionId, type: "interrupt", at });
}

export function cloneInterruptedRunAsPending(run: Run, newRunId: string, at: string): Run;
export function cloneInterruptedRunAsPending(repositories: { runs: RunRepository }, runId: string, newRunId: string, clock: Clock): Promise<Run>;
export function cloneInterruptedRunAsPending(
  runOrRepositories: Run | { runs: RunRepository },
  runIdOrNewRunId: string,
  atOrNewRunId: string,
  clock?: Clock
): Run | Promise<Run> {
  if ("runs" in runOrRepositories) {
    return cloneInterruptedRunFromRepository(runOrRepositories, runIdOrNewRunId, atOrNewRunId, clock);
  }
  return cloneInterruptedRunValue(runOrRepositories, runIdOrNewRunId, atOrNewRunId);
}

function cloneInterruptedRunValue(run: Run, newRunId: string, at: string): Run {
  if (run.status !== "INTERRUPTED") {
    throw new TransitionError("only interrupted runs can be cloned");
  }
  return {
    ...run,
    id: newRunId,
    status: "PENDING",
    stopReason: null,
    stopDetail: null,
    budgetUsage: { rounds: 0, tokens: 0, elapsedMs: 0, repeatedFailures: 0 },
    transitionIds: [],
    createdAt: at,
    updatedAt: at
  };
}

async function cloneInterruptedRunFromRepository(
  repositories: { runs: RunRepository },
  runId: string,
  newRunId: string,
  clock: Clock | undefined
): Promise<Run> {
  if (clock === undefined) throw new TransitionError("clock is required");
  const run = await repositories.runs.getById(runId);
  if (run === null) throw new TransitionError(`run ${runId} not found`);
  const cloned = cloneInterruptedRunValue(run, newRunId, clock.nowIso());
  return repositories.runs.create(cloned);
}

export async function interruptActiveRuns(
  repositories: { runs: RunRepository },
  clock: Clock
): Promise<Run[]> {
  const interrupted: Run[] = [];
  const activeRuns = await repositories.runs.listActive();
  for (const active of activeRuns) {
    const next = interruptRun(active, `interrupt:${active.id}:${clock.nowIso()}`, clock.nowIso());
    interrupted.push(await repositories.runs.update(next));
  }
  return interrupted;
}
