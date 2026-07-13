import type { ValidationResult } from "@gcah/shared";

import { classifyFailure } from "./classifier.js";

export interface QueuedFeedback {
  sourceId: string;
  category: string;
  summary: string;
}

export class FeedbackQueue {
  private readonly queued = new Map<string, QueuedFeedback>();

  enqueueValidation(result: ValidationResult): void {
    if (result.result === "PASS" || result.result === "SKIPPED") return;
    const classification = classifyFailure(result.diagnosticSummary ?? result.failureCategory ?? result.result);
    if (!this.queued.has(result.id)) {
      this.queued.set(result.id, {
        sourceId: result.id,
        category: classification.category,
        summary: `Validation failed: ${classification.category}`
      });
    }
  }

  consumeOnce(): QueuedFeedback[] {
    const entries = [...this.queued.values()];
    this.queued.clear();
    return entries;
  }
}
