import type { ConfigSnapshot } from "@gcah/shared";

import type { BudgetSnapshot } from "../budget/budget.js";
import type { MemorySearchResult } from "../memory/retrieval.js";
import type { QueuedFeedback } from "../validation/feedback.js";

export interface LoopContextInput {
  taskSummary: string;
  configSnapshot: ConfigSnapshot;
  memories: MemorySearchResult[];
  feedback: QueuedFeedback[];
  budget: BudgetSnapshot;
  maxChars: number;
}

export interface LoopContext {
  messages: readonly string[];
  summary: string;
}

export function buildLoopContext(input: LoopContextInput): LoopContext {
  const text = [
    `Task: ${input.taskSummary}`,
    `Config: ${input.configSnapshot.id} hash=${input.configSnapshot.contentHash}`,
    `Budget: rounds=${input.budget.rounds} tokens=${input.budget.tokens} elapsedMs=${input.budget.elapsedMs} usageUnavailable=${input.budget.usageUnavailable}`,
    "Feedback:",
    ...input.feedback.map((feedback) => `- [${feedback.category}] ${feedback.summary}`),
    "Memory:",
    ...input.memories.map((memory) => `- [${memory.sourceType}] grantsAuthority=${memory.grantsAuthority}: ${memory.text}`)
  ].join("\n");
  const summary = text.slice(0, Math.max(0, input.maxChars));
  return {
    messages: [summary],
    summary
  };
}
