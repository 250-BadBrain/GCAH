export function applySingleHunk(current: string, unifiedDiff: string): string {
  const removed = unifiedDiff
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("-") && !line.startsWith("---"))
    .map((line) => line.slice(1));
  const added = unifiedDiff
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
  if (removed.length === 0 && added.length === 0) {
    throw new Error("EMPTY_DIFF");
  }
  const oldText = `${removed.join("\n")}\n`;
  const newText = `${added.join("\n")}\n`;
  if (!current.includes(oldText)) {
    throw new Error("PATCH_MISMATCH");
  }
  return current.replace(oldText, newText);
}
