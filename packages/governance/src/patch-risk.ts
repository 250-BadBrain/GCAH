const SENSITIVE_PATHS = [
  /^package(-lock)?\.json$/iu,
  /^pnpm-lock\.yaml$/iu,
  /^yarn\.lock$/iu,
  /^\.github[\\/]/iu,
  /^\.gitlab-ci\.ya?ml$/iu,
  /^\.gcah[\\/]config\.ya?ml$/iu,
  /^tsconfig/iu
];

export interface PatchRiskInput {
  path: string;
  unifiedDiff: string;
}

export interface PatchRisk {
  riskCategory: "low" | "lockfile" | "config" | "ci" | "large_patch";
  requiresApproval: boolean;
  changedLines: number;
}

export function assessPatchRisk(input: PatchRiskInput): PatchRisk {
  const changedLines = input.unifiedDiff
    .split(/\r?\n/u)
    .filter((line) => (line.startsWith("+") || line.startsWith("-")) && !line.startsWith("+++") && !line.startsWith("---"))
    .length;

  if (changedLines > 100) {
    return { riskCategory: "large_patch", requiresApproval: true, changedLines };
  }
  if (/lock/iu.test(input.path) || /^pnpm-lock\.yaml$/iu.test(input.path)) {
    return { riskCategory: "lockfile", requiresApproval: true, changedLines };
  }
  if (/^\.github[\\/]/iu.test(input.path) || /^\.gitlab-ci\.ya?ml$/iu.test(input.path)) {
    return { riskCategory: "ci", requiresApproval: true, changedLines };
  }
  if (SENSITIVE_PATHS.some((pattern) => pattern.test(input.path))) {
    return { riskCategory: "config", requiresApproval: true, changedLines };
  }
  return { riskCategory: "low", requiresApproval: false, changedLines };
}
