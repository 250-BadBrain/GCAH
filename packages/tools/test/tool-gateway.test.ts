import { describe, expect, it } from "vitest";

import { createToolGateway, ToolRegistry } from "../src/index.js";
import type { ApprovalService, GovernanceDecision, GovernanceEngine, NormalizedAction } from "@gcah/governance";
import type { RunEvent } from "@gcah/shared";

function governance(result: GovernanceDecision["result"], trace: string[]): GovernanceEngine {
  return {
    decide(action: NormalizedAction) {
      trace.push(`governance:${action.tool}`);
      return {
        result,
        ruleId: `test.${result.toLowerCase()}`,
        riskCategory: result === "ALLOW" ? "low" : "mutation",
        explanation: "test"
      };
    }
  };
}

function approval(authorized: boolean, trace: string[]): Pick<ApprovalService, "authorize"> {
  return {
    authorize() {
      trace.push("approval");
      return authorized
        ? { authorized: true, grant: { id: "grant-1", runId: "run-1", normalizedActionHash: "hash", scopeHash: "scope", expiresAtRound: 2, grantedBy: "human" } }
        : { authorized: false, reason: "NO_GRANT" };
    }
  };
}

describe("ToolGateway", () => {
  it("validates, normalizes, persists governance, rechecks approval, then executes", async () => {
    const trace: string[] = [];
    const registry = new ToolRegistry();
    registry.register({
      tool: "read",
      execute: async (request) => {
        trace.push(`execute:${request.tool}`);
        const args = request.args as { path: string };
        return { status: "OK", summary: `read ${args.path}` };
      }
    });
    const gateway = createToolGateway({
      runId: "run-1",
      actionIdFactory: () => "action-1",
      unitOfWork: {
        repositories: {} as never,
        transaction: async (work) => {
          trace.push("transaction");
          return work({
            events: {
              append: async (event: Omit<RunEvent, "cursor"> & { cursor?: number }) => {
                trace.push(`event:${event.type}`);
                return { ...event, cursor: 1 };
              },
              listAfterCursor: async () => []
            }
          } as never);
        }
      },
      governance: governance("ALLOW", trace),
      approval: approval(false, trace),
      registry
    });

    await expect(gateway.execute({ tool: "read", args: { path: "README.md" } })).resolves.toEqual({
      status: "OK",
      summary: "read README.md"
    });
    expect(trace).toEqual([
      "governance:read",
      "transaction",
      "event:governance.decision",
      "execute:read"
    ]);
  });

  it("does not execute denied or waiting actions", async () => {
    for (const result of ["DENY", "REQUIRE_APPROVAL"] as const) {
      const trace: string[] = [];
      const registry = new ToolRegistry();
      registry.register({
        tool: "write",
        execute: async () => {
          trace.push("execute");
          return { status: "OK", summary: "bad" };
        }
      });
      const gateway = createToolGateway({
        runId: "run-1",
        actionIdFactory: () => "action-1",
        unitOfWork: {
          repositories: {} as never,
          transaction: async (work) => work({
            events: { append: async (event: Omit<RunEvent, "cursor"> & { cursor?: number }) => ({ ...event, cursor: 1 }), listAfterCursor: async () => [] }
          } as never)
        },
        governance: governance(result, trace),
        approval: approval(false, trace),
        registry
      });

      await expect(gateway.execute({ tool: "write", args: { path: "src/app.ts", content: "x" } })).resolves.toMatchObject({
        status: "ERROR"
      });
      expect(trace).not.toContain("execute");
    }
  });

  it("does not execute when persistence fails before dispatch", async () => {
    const trace: string[] = [];
    const registry = new ToolRegistry();
    registry.register({
      tool: "read",
      execute: async () => {
        trace.push("execute");
        return { status: "OK", summary: "bad" };
      }
    });
    const gateway = createToolGateway({
      runId: "run-1",
      actionIdFactory: () => "action-1",
      unitOfWork: {
        repositories: {} as never,
        transaction: async () => {
          throw new Error("persist failed");
        }
      },
      governance: governance("ALLOW", trace),
      approval: approval(false, trace),
      registry
    });

    await expect(gateway.execute({ tool: "read", args: { path: "README.md" } })).resolves.toMatchObject({
      status: "ERROR"
    });
    expect(trace).toEqual(["governance:read"]);
  });
});
