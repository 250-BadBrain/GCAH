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
  let remaining = Math.max(0, charBudget);
  const results: MemorySearchResult[] = [];
  for (const entry of entries
    .map((entry) => {
      const tagScore = tags.filter((tag) => entry.tags.includes(tag)).length;
      const keywordScore = keywords.filter((keyword) => entry.keywords.includes(keyword.toLowerCase())).length;
      return { entry, score: tagScore * 10 + keywordScore };
    })
    .sort((left, right) => right.score - left.score || right.entry.createdAt.localeCompare(left.entry.createdAt))) {
    if (remaining <= 0) break;
    const text = entry.entry.summary.slice(0, remaining);
    remaining -= text.length;
    results.push({
      text,
      sourceType: entry.entry.type,
      grantsAuthority: false as const
    });
  }
  return results;
}
