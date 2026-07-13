export { PathBoundaryError } from "./path/path-error.js";
export {
  createWorkspaceFence,
  type WorkspaceFence,
  type WorkspaceFenceOptions,
  type WorkspaceFenceResult
} from "./path/workspace-fence.js";
export {
  createGovernanceEngine,
  type GovernanceDecision,
  type GovernanceEngine,
  type GovernanceResult,
  type NormalizedAction,
  type PolicySnapshot
} from "./decision.js";
export { assessPatchRisk, type PatchRisk, type PatchRiskInput } from "./patch-risk.js";
export { PUBLIC_DEMO_POLICY } from "./public-demo-policy.js";
export {
  ApprovalService,
  type ApprovalFeedback,
  type ApprovalRequestRecord,
  type ApprovalStatus,
  type SessionGrant
} from "./approval/approval-service.js";
export {
  canonicalJson,
  normalizedActionHash,
  normalizeActionForHash,
  scopeHash,
  type HashableAction,
  type ScopeHashInput
} from "./approval/action-hash.js";
export { deriveApprovalScope, type ApprovalScope } from "./approval/scope.js";
