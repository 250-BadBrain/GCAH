import type { MemoryEntry } from "@gcah/shared";

import type { MemoryRepository } from "../ports/repositories.js";
import { rankMemories, tokenize, type MemorySearchResult } from "./retrieval.js";

interface MemoryInput {
  workspaceId: string;
  runId: string;
  summary: string;
  tags: string[];
}

export class MemoryService {
  private sequence = 0;

  constructor(
    private readonly repository: MemoryRepository,
    private readonly nowIso: () => string
  ) {}

  addProjectConvention(input: MemoryInput): Promise<MemoryEntry> {
    return this.add("project_constraint", input);
  }

  recordApprovalSummary(input: MemoryInput): Promise<MemoryEntry> {
    return this.add("approval_decision", input);
  }

  recordFailureSummary(input: MemoryInput): Promise<MemoryEntry> {
    return this.add("failure_summary", input);
  }

  addLlmMemoryForTest(): never {
    throw new Error("LLM-origin memory writes are not allowed");
  }

  async search(input: { workspaceId: string; tags: string[]; keywords: string[]; limit: number; charBudget: number }): Promise<MemorySearchResult[]> {
    const query = input.keywords.join(" ");
    const entries = await this.repository.search({
      workspaceId: input.workspaceId,
      query,
      tags: input.tags,
      limit: input.limit
    });
    return rankMemories(entries, input.tags, input.keywords, input.charBudget).slice(0, input.limit);
  }

  private add(type: MemoryEntry["type"], input: MemoryInput): Promise<MemoryEntry> {
    this.sequence += 1;
    return this.repository.add({
      id: `memory-${this.sequence}`,
      workspaceId: input.workspaceId,
      type,
      tags: input.tags,
      keywords: tokenize(input.summary),
      sourceRunId: input.runId,
      summary: input.summary,
      createdAt: this.nowIso()
    });
  }
}
