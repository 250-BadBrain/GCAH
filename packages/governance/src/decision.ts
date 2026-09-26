import type { ToolAction } from "@gcah/shared";
import path from "node:path";

import { assessPatchRisk } from "./patch-risk.js";

export type NormalizedAction = ToolAction & {
  normalizedSummary: string;
};

export type GovernanceResult = "ALLOW" | "REQUIRE_APPROVAL" | "DENY";

export interface GovernanceDecision {
  result: GovernanceResult;
  ruleId: string;
  riskCategory: string;
  explanation: string;
}

export interface GovernanceEngine {
  decide(action: NormalizedAction): GovernanceDecision;
}

function pathOf(action: NormalizedAction): string | null {
  if ("path" in action.args && typeof action.args.path === "string") return action.args.path;
  return null;
}

function isPathEscape(targetPath: string): boolean {
  return targetPath.includes("..")
    || targetPath.startsWith("/")
    || targetPath.startsWith("\\")
    || /^[A-Za-z]:[\\/]/u.test(targetPath)
    || path.win32.isAbsolute(targetPath);
}

function isCredentialPath(targetPath: string): boolean {
  return /(^|[\\/])(\.env|id_rsa|credentials?|secrets?)([\\/.]|$)/iu.test(targetPath);
}

function isAuditPath(targetPath: string): boolean {
  return /^\.gcah[\\/](audit|credentials?|secrets?)([\\/]|$)/iu.test(targetPath);
}

function isGuardrailPath(targetPath: string): boolean {
  return /^\.gcah[\\/](guardrails?|policy)([\\/]|$)/iu.test(targetPath)
    || /(^|[\\/])guardrails?([\\/]|$)/iu.test(targetPath);
}

function commandRequiresApproval(executable: string, args: readonly string[]): boolean {
  const command = [executable, ...args].join(" ").toLowerCase();
  return /\b(pnpm|npm|yarn|bun)\s+(add|install|remove|update)\b/u.test(command)
    || /\bgit\b/u.test(command)
    || /\b(curl|wget|ssh|scp|powershell|pwsh)\b/u.test(command);
}

function commandDenied(executable: string): boolean {
  const baseName = path.win32.basename(executable).replace(/\.exe$/iu, "");
  const posixName = path.posix.basename(baseName).replace(/\.exe$/iu, "");
  return /^(sudo|su|runas)$/iu.test(posixName);
}

function decision(result: GovernanceResult, ruleId: string, riskCategory: string, explanation: string): GovernanceDecision {
  return { result, ruleId, riskCategory, explanation };
}

export function createGovernanceEngine(): GovernanceEngine {
  return {
    decide(action) {
      const targetPath = pathOf(action);
      if (targetPath !== null) {
        if (isPathEscape(targetPath)) return decision("DENY", "path.escape", "path", "path escapes workspace boundary");
        if (isCredentialPath(targetPath)) return decision("DENY", "path.credential", "credential", "credential path is denied");
        if (isAuditPath(targetPath)) return decision("DENY", "path.audit", "audit", "audit and credential storage paths are denied");
        if (isGuardrailPath(targetPath)) return decision("DENY", "path.guardrail", "guardrail", "guardrail paths are denied");
      }

      if (action.tool === "run_command" && commandDenied(action.args.executable)) {
        return decision("DENY", "command.elevation", "elevation", "privilege elevation is denied");
      }

      if (action.tool === "patch") {
        const risk = assessPatchRisk(action.args);
        if (risk.requiresApproval) return decision("REQUIRE_APPROVAL", `patch.${risk.riskCategory}`, risk.riskCategory, "patch requires human approval");
        return decision("ALLOW", "patch.small", risk.riskCategory, "small ordinary patch is allowed");
      }

      if (action.tool === "write" || action.tool === "delete") {
        return decision("REQUIRE_APPROVAL", `tool.${action.tool}`, "mutation", "workspace mutation requires approval");
      }

      if (action.tool === "run_command") {
        if (commandRequiresApproval(action.args.executable, action.args.args)) {
          return decision("REQUIRE_APPROVAL", "command.risky", "command", "risky command requires approval");
        }
        return decision("REQUIRE_APPROVAL", "command.default", "command", "commands require approval by default");
      }

      return decision("ALLOW", `tool.${action.tool}.safe`, "low", "safe read-only action is allowed");
    }
  };
}
