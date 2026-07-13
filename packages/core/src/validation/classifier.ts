export interface FailureClassification {
  category: "test_assertion" | "lint" | "typecheck" | "policy" | "infra" | "timeout" | "repeat";
  repairable: boolean;
}

export function classifyFailure(summary: string): FailureClassification {
  const normalized = summary.toLowerCase();
  if (/repeat|repeated/u.test(normalized)) return { category: "repeat", repairable: false };
  if (/timeout|timed out|etimedout/u.test(normalized)) return { category: "timeout", repairable: false };
  if (/policy|denied|guardrail/u.test(normalized)) return { category: "policy", repairable: false };
  if (/enoent|eacces|network|infra/u.test(normalized)) return { category: "infra", repairable: false };
  if (/ts\d+|typecheck|not assignable/u.test(normalized)) return { category: "typecheck", repairable: true };
  if (/eslint|lint|no-unused-vars/u.test(normalized)) return { category: "lint", repairable: true };
  return { category: "test_assertion", repairable: true };
}
