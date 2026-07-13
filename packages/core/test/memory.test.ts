import { describe, expect, it } from "vitest";

import { MemoryService } from "../src/index.js";
import type { MemoryRepository } from "../src/index.js";
import type { MemoryEntry } from "@gcah/shared";

class FakeMemoryRepository implements MemoryRepository {
  readonly entries: MemoryEntry[] = [];
  async add(entry: MemoryEntry): Promise<MemoryEntry> {
    this.entries.push(structuredClone(entry));
    return entry;
  }
  async search(query: { workspaceId: string; query: string; tags?: string[]; limit?: number }): Promise<MemoryEntry[]> {
    const needle = query.query.toLowerCase();
    return this.entries
      .filter((entry) => entry.workspaceId === query.workspaceId)
      .filter((entry) => (query.tags ?? []).length === 0 || (query.tags ?? []).some((tag) => entry.tags.includes(tag)))
      .filter((entry) => [entry.summary, ...entry.keywords, ...entry.tags].join(" ").toLowerCase().includes(needle))
      .slice(0, query.limit ?? 10);
  }
}

describe("MemoryService", () => {
  it("writes only authorized memory sources and rejects LLM-origin writes", async () => {
    const service = new MemoryService(new FakeMemoryRepository(), () => "2026-07-13T00:00:00.000Z");
    await expect(service.addProjectConvention({ workspaceId: "w1", runId: "r1", summary: "Use pnpm", tags: ["tooling"] })).resolves.toMatchObject({
      type: "project_constraint"
    });
    await expect(service.recordApprovalSummary({ workspaceId: "w1", runId: "r1", summary: "Approved patch only", tags: ["approval"] })).resolves.toMatchObject({
      type: "approval_decision"
    });
    await expect(service.recordFailureSummary({ workspaceId: "w1", runId: "r1", summary: "Lint failed", tags: ["failure"] })).resolves.toMatchObject({
      type: "failure_summary"
    });
    expect(() => service.addLlmMemoryForTest()).toThrow(/not allowed/i);
  });

  it("retrieves by keyword/tag under budgets and does not grant authority", async () => {
    const repo = new FakeMemoryRepository();
    const service = new MemoryService(repo, () => "2026-07-13T00:00:00.000Z");
    await service.recordApprovalSummary({ workspaceId: "w1", runId: "r1", summary: "Human approved writing README only", tags: ["approval"] });
    await service.addProjectConvention({ workspaceId: "w2", runId: "r2", summary: "Other workspace README", tags: ["approval"] });

    await expect(service.search({ workspaceId: "w1", tags: ["approval"], keywords: ["README"], limit: 5, charBudget: 20 })).resolves.toEqual([
      {
        text: "Human approved writi",
        sourceType: "approval_decision",
        grantsAuthority: false
      }
    ]);
  });
});
