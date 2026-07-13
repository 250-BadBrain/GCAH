import type { SupportedToolName } from "@gcah/shared";

import type { NormalizedAction } from "../decision.js";

export interface ApprovalScope {
  tool: SupportedToolName;
  pathScope: string | null;
  commandTemplate: string | null;
  riskCategory: string;
}

export function deriveApprovalScope(action: NormalizedAction, riskCategory: string): ApprovalScope {
  const pathScope = "path" in action.args && typeof action.args.path === "string" ? action.args.path : null;
  const commandTemplate = action.tool === "run_command"
    ? [action.args.executable, ...action.args.args].join(" ")
    : null;
  return {
    tool: action.tool,
    pathScope,
    commandTemplate,
    riskCategory
  };
}
