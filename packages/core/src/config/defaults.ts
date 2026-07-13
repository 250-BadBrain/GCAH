import type { GcahConfig } from "./schema.js";

export const DEFAULT_CONFIG: GcahConfig = {
  mode: "local",
  budgets: {
    maxRounds: 10,
    maxTokens: 100000,
    maxElapsedMs: 3600000
  },
  validation: {
    required: []
  },
  riskThresholds: {
    requireApproval: "medium",
    deny: "high"
  },
  commands: {},
  allowedWorkspaceRoots: [],
  executorBackend: "local",
  llm: {
    provider: "mock"
  }
};
