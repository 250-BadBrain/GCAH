import type { ToolGatewayPort, ToolGatewayRequest, ToolGatewayResult, UnitOfWork } from "@gcah/core";
import type { ApprovalService, GovernanceEngine, NormalizedAction } from "@gcah/governance";
import { ToolArgsByName } from "@gcah/shared";
import type { Action, RunEvent } from "@gcah/shared";

import type { ToolRegistry } from "./tool-registry.js";

export interface ToolGatewayOptions {
  runId: string;
  actionIdFactory(): string;
  unitOfWork: UnitOfWork;
  governance: GovernanceEngine;
  approval: Pick<ApprovalService, "authorize">;
  registry: ToolRegistry;
}

function nowIso(): string {
  return new Date(0).toISOString();
}

function normalize(request: ToolGatewayRequest): NormalizedAction {
  const schema = ToolArgsByName[request.tool];
  const args = schema.parse(request.args) as NormalizedAction["args"];
  return {
    kind: "tool",
    tool: request.tool,
    args,
    rationale: "",
    normalizedSummary: `${request.tool} ${JSON.stringify(args)}`
  } as NormalizedAction;
}

function actionEntity(actionId: string, normalized: NormalizedAction): Action {
  return {
    id: actionId,
    stepId: "step-pending",
    kind: "tool",
    toolName: normalized.tool,
    finishSummary: null,
    args: normalized.args,
    displayRationale: "",
    normalizedSummary: normalized.normalizedSummary,
    riskCategory: "pending",
    status: "PROPOSED",
    createdAt: nowIso(),
    updatedAt: nowIso()
  } as Action;
}

function decisionEvent(runId: string, actionId: string, result: string): Omit<RunEvent, "cursor"> {
  return {
    id: `event:${actionId}:governance`,
    runId,
    stepId: null,
    type: "governance.decision",
    relatedEntityId: actionId,
    summary: `governance ${result}`,
    createdAt: nowIso()
  };
}

function error(summary: string): ToolGatewayResult {
  return { status: "ERROR", summary };
}

export function createToolGateway(options: ToolGatewayOptions): ToolGatewayPort {
  return {
    async execute(request) {
      const definition = options.registry.get(request.tool);
      if (definition === null) return error(`tool ${request.tool} is not registered`);

      let normalized: NormalizedAction;
      try {
        normalized = normalize(request);
      } catch {
        return error("tool arguments failed schema validation");
      }

      const decision = options.governance.decide(normalized, { mode: "local" });
      if (decision.result === "DENY") return error("governance denied action");
      if (decision.result === "REQUIRE_APPROVAL") {
        const authorization = options.approval.authorize({
          runId: options.runId,
          action: normalized,
          riskCategory: decision.riskCategory,
          currentRound: 1
        });
        if (!authorization.authorized) return error("approval required");
      }

      try {
        await options.unitOfWork.transaction(async (repositories) => {
          const action = actionEntity(options.actionIdFactory(), normalized);
          await repositories.actions.create(action);
          await repositories.events.append(decisionEvent(options.runId, action.id, decision.result));
        });
      } catch {
        return error("persistence failed before dispatch");
      }

      try {
        return await definition.execute({ tool: request.tool, args: normalized.args }, { authorized: true });
      } catch (executionError) {
        const code = executionError instanceof Error && "code" in executionError && typeof executionError.code === "string"
          ? executionError.code
          : "TOOL_EXECUTION_FAILED";
        return error(code);
      }
    }
  };
}
