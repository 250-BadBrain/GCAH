export function applySingleHunk(current: string, unifiedDiff: string): string {
  const hunkLines = unifiedDiff
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith("---") && !line.startsWith("+++") && !line.startsWith("@@"));
  const oldLines: string[] = [];
  const newLines: string[] = [];
  for (const line of hunkLines) {
    if (line.startsWith("-")) {
      oldLines.push(line.slice(1));
    } else if (line.startsWith("+")) {
      newLines.push(line.slice(1));
    } else {
      const context = line.startsWith(" ") ? line.slice(1) : line;
      oldLines.push(context);
      newLines.push(context);
    }
  }
  if (oldLines.length === 0 && newLines.length === 0) {
    throw new Error("EMPTY_DIFF");
  }
  const oldTextWithNewline = `${oldLines.join("\n")}\n`;
  const newTextWithNewline = `${newLines.join("\n")}\n`;
  if (current.includes(oldTextWithNewline)) {
    return current.replace(oldTextWithNewline, newTextWithNewline);
  }
  const oldText = oldLines.join("\n");
  const newText = newLines.join("\n");
  if (!current.includes(oldText)) {
    throw new Error("PATCH_MISMATCH");
  }
  return current.replace(oldText, newText);
}
