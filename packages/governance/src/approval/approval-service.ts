import type { StopReason } from "@gcah/shared";

import type { NormalizedAction } from "../decision.js";
import { normalizedActionHash, scopeHash } from "./action-hash.js";
import { deriveApprovalScope, type ApprovalScope } from "./scope.js";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface ApprovalRequestRecord {
  id: string;
  runId: string;
  actionId: string;
  normalizedActionHash: string;
  actionSummary: string;
  riskCategory: string;
  scope: ApprovalScope;
  scopeHash: string;
  status: ApprovalStatus;
  createdAtRound: number;
  expiresAtRound: number;
  decidedAtRound: number | null;
  humanReason: string | null;
}

export interface SessionGrant {
  id: string;
  runId: string;
  normalizedActionHash: string;
  scopeHash: string;
  expiresAtRound: number;
  grantedBy: string;
}

export interface ApprovalFeedback {
  category: "approval_rejected";
  summary: string;
}

export class ApprovalService {
  private readonly requests = new Map<string, ApprovalRequestRecord>();
  private readonly grants: SessionGrant[] = [];
  private readonly rejectedClasses = new Set<string>();

  request(input: {
    requestId: string;
    runId: string;
    actionId: string;
    action: NormalizedAction;
    riskCategory: string;
    currentRound: number;
    expiresAtRound: number;
  }): ApprovalRequestRecord {
    const existing = this.requests.get(input.requestId);
    if (existing !== undefined) return existing;
    const scope = deriveApprovalScope(input.action, input.riskCategory);
    const record: ApprovalRequestRecord = {
      id: input.requestId,
      runId: input.runId,
      actionId: input.actionId,
      normalizedActionHash: normalizedActionHash(input.action),
      actionSummary: input.action.normalizedSummary,
      riskCategory: input.riskCategory,
      scope,
      scopeHash: scopeHash(scope),
      status: "PENDING",
      createdAtRound: input.currentRound,
      expiresAtRound: input.expiresAtRound,
      decidedAtRound: null,
      humanReason: null
    };
    this.requests.set(record.id, record);
    return record;
  }

  approve(requestId: string, input: { grantId: string; currentRound: number; grantedBy: string }): ApprovalRequestRecord {
    const record = this.requireRequest(requestId);
    if (record.status === "APPROVED") return record;
    if (record.status !== "PENDING") return record;
    const updated = { ...record, status: "APPROVED" as const, decidedAtRound: input.currentRound };
    this.requests.set(requestId, updated);
    this.grants.push({
      id: input.grantId,
      runId: updated.runId,
      normalizedActionHash: updated.normalizedActionHash,
      scopeHash: updated.scopeHash,
      expiresAtRound: updated.expiresAtRound,
      grantedBy: input.grantedBy
    });
    return updated;
  }

  reject(requestId: string, input: { currentRound: number; humanReason: string }): ApprovalRequestRecord & {
    feedback: ApprovalFeedback | null;
    stopReason: StopReason | null;
  } {
    const record = this.requireRequest(requestId);
    if (record.status === "REJECTED") {
      return { ...record, feedback: null, stopReason: null };
    }
    if (record.status !== "PENDING") {
      return { ...record, feedback: null, stopReason: null };
    }
    const classKey = `${record.runId}:${record.riskCategory}:${record.scopeHash}`;
    const repeated = this.rejectedClasses.has(classKey);
    this.rejectedClasses.add(classKey);
    const updated = {
      ...record,
      status: "REJECTED" as const,
      decidedAtRound: input.currentRound,
      humanReason: input.humanReason
    };
    this.requests.set(requestId, updated);
    return {
      ...updated,
      feedback: repeated ? null : {
        category: "approval_rejected",
        summary: `Approval rejected for ${record.actionSummary}`
      },
      stopReason: repeated ? "APPROVAL_REJECTED" : null
    };
  }

  authorize(input: {
    runId: string;
    action: NormalizedAction;
    riskCategory: string;
    currentRound: number;
  }): { authorized: true; grant: SessionGrant } | { authorized: false; reason: "NO_GRANT" | "RUN_MISMATCH" | "ACTION_CHANGED" | "SCOPE_CHANGED" | "EXPIRED" } {
    const actionHash = normalizedActionHash(input.action);
    const scope = deriveApprovalScope(input.action, input.riskCategory);
    const currentScopeHash = scopeHash(scope);
    const grant = this.grants.find((candidate) =>
      candidate.runId === input.runId
      && candidate.normalizedActionHash === actionHash
      && candidate.scopeHash === currentScopeHash
      && input.currentRound <= candidate.expiresAtRound
    );
    if (grant !== undefined) return { authorized: true, grant };

    const partialGrant = this.grants.find((candidate) =>
      candidate.runId === input.runId
      || candidate.normalizedActionHash === actionHash
      || candidate.scopeHash === currentScopeHash
    );
    if (partialGrant === undefined) return { authorized: false, reason: "NO_GRANT" };
    if (partialGrant.runId !== input.runId) return { authorized: false, reason: "RUN_MISMATCH" };
    if (partialGrant.normalizedActionHash !== actionHash) return { authorized: false, reason: "ACTION_CHANGED" };
    if (partialGrant.scopeHash !== currentScopeHash) return { authorized: false, reason: "SCOPE_CHANGED" };
    if (input.currentRound > partialGrant.expiresAtRound) return { authorized: false, reason: "EXPIRED" };
    return { authorized: false, reason: "NO_GRANT" };
  }

  private requireRequest(requestId: string): ApprovalRequestRecord {
    const record = this.requests.get(requestId);
    if (record === undefined) throw new Error(`approval request ${requestId} not found`);
    return record;
  }
}
