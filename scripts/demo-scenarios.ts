export interface DemoScenario {
  marker: string;
  summary: string;
}

export const demoScenarios: readonly DemoScenario[] = [
  {
    marker: "DANGEROUS_ACTION_DENIED",
    summary: "governance denies a dangerous shell action before execution"
  },
  {
    marker: "VALIDATION_FAILED",
    summary: "validation failure is classified and persisted for feedback"
  },
  {
    marker: "MOCK_ACTION_CHANGED",
    summary: "Mock LLM changes the next action after feedback is injected"
  },
  {
    marker: "SESSION_GRANT_EXPIRED",
    summary: "session approval expires at its configured round boundary"
  },
  {
    marker: "REAPPROVAL_REQUIRED",
    summary: "the same risky action requires a fresh approval after expiry"
  }
];
