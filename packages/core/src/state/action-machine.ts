import type { Action } from "@gcah/shared";

import { TransitionError } from "./transition-error.js";

export type ActionTransition =
  | { id: string; type: "deny"; at: string }
  | { id: string; type: "require_approval"; at: string }
  | { id: string; type: "approve"; at: string }
  | { id: string; type: "execute"; at: string }
  | { id: string; type: "fail"; at: string }
  | { id: string; type: "skip"; at: string };

const transitionIds = new WeakMap<Action, Set<string>>();

export function transitionAction(action: Action, transition: ActionTransition): Action {
  if (transitionIds.get(action)?.has(transition.id)) {
    return action;
  }
  if (["DENIED", "EXECUTED", "FAILED", "SKIPPED"].includes(action.status)) {
    throw new TransitionError(`${action.status} action cannot transition`);
  }

  const base = { ...action, updatedAt: transition.at };
  const next = (() => {
    switch (transition.type) {
      case "deny":
        if (action.status !== "PROPOSED") throw new TransitionError("only proposed actions can be denied");
        return { ...base, status: "DENIED" as const };
      case "require_approval":
        if (action.status !== "PROPOSED") throw new TransitionError("only proposed actions can wait");
        return { ...base, status: "WAITING_APPROVAL" as const };
      case "approve":
        if (action.status !== "WAITING_APPROVAL") throw new TransitionError("only waiting actions can approve");
        return { ...base, status: "APPROVED" as const };
      case "execute":
        if (!["PROPOSED", "APPROVED"].includes(action.status)) throw new TransitionError("action cannot execute");
        return { ...base, status: "EXECUTED" as const };
      case "fail":
        return { ...base, status: "FAILED" as const };
      case "skip":
        return { ...base, status: "SKIPPED" as const };
    }
  })();
  const seen = new Set(transitionIds.get(action) ?? []);
  seen.add(transition.id);
  transitionIds.set(next, seen);
  return next;
}
