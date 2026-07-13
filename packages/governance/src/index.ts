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
