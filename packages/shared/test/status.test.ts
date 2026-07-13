import { describe, expect, it } from "vitest";

import {
  ActionStatus,
  RunStatus,
  RunStatusStopReasons,
  StepStatus,
  StopReason
} from "../src/status.js";

describe("status contracts", () => {
  it("defines the exact SPEC run, step, action, and stop statuses", () => {
    expect(RunStatus.options).toEqual([
      "PENDING",
      "RUNNING",
      "WAITING_APPROVAL",
      "COMPLETED",
      "STOPPED",
      "FAILED",
      "INTERRUPTED",
      "CANCELLED"
    ]);
    expect(StepStatus.options).toEqual([
      "PENDING",
      "BUILDING_CONTEXT",
      "WAITING_LLM",
      "PARSING_RESPONSE",
      "PROPOSED_ACTION",
      "WAITING_APPROVAL",
      "EXECUTING_TOOL",
      "VALIDATING",
      "FEEDBACK_RECORDED",
      "COMPLETED",
      "FAILED",
      "SKIPPED"
    ]);
    expect(ActionStatus.options).toEqual([
      "PROPOSED",
      "DENIED",
      "WAITING_APPROVAL",
      "APPROVED",
      "EXECUTED",
      "FAILED",
      "SKIPPED"
    ]);
    expect(StopReason.options).toEqual([
      "COMPLETED",
      "BUDGET_EXHAUSTED",
      "USER_CANCELLED",
      "POLICY_DENIED",
      "APPROVAL_REJECTED",
      "UNFIXABLE_FAILURE",
      "REPEATED_FAILURE",
      "PROTOCOL_ERROR",
      "INTERRUPTED"
    ]);
  });

  it("maps terminal run statuses to the allowed stop reasons", () => {
    expect(RunStatusStopReasons.COMPLETED).toEqual(["COMPLETED"]);
    expect(RunStatusStopReasons.CANCELLED).toEqual(["USER_CANCELLED"]);
    expect(RunStatusStopReasons.INTERRUPTED).toEqual(["INTERRUPTED"]);
    expect(RunStatusStopReasons.STOPPED).toEqual([
      "BUDGET_EXHAUSTED",
      "POLICY_DENIED",
      "APPROVAL_REJECTED",
      "REPEATED_FAILURE",
      "PROTOCOL_ERROR"
    ]);
    expect(RunStatusStopReasons.FAILED).toEqual(["UNFIXABLE_FAILURE"]);
    expect(RunStatusStopReasons.WAITING_APPROVAL).toEqual([]);
  });
});
