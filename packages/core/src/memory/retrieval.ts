import type { MemoryEntry } from "@gcah/shared";

export interface MemorySearchResult {
  text: string;
  sourceType: MemoryEntry["type"];
  grantsAuthority: false;
}

export function tokenize(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9_]+/gu) ?? [])];
}

export function rankMemories(entries: MemoryEntry[], tags: string[], keywords: string[], charBudget: number): MemorySearchResult[] {
  return entries
    .map((entry) => {
      const tagScore = tags.filter((tag) => entry.tags.includes(tag)).length;
      const keywordScore = keywords.filter((keyword) => entry.keywords.includes(keyword.toLowerCase())).length;
      return { entry, score: tagScore * 10 + keywordScore };
    })
    .sort((left, right) => right.score - left.score || right.entry.createdAt.localeCompare(left.entry.createdAt))
    .map(({ entry }) => ({
      text: entry.summary.slice(0, charBudget),
      sourceType: entry.type,
      grantsAuthority: false as const
    }));
}
