export function normalizeFailureSummary(summary: string): string {
  return summary
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/gu, "<timestamp>")
    .replace(/[A-Za-z]:[\\/][^\s:]+(?:[\\/][^\s:]+)*/gu, "<path>")
    .replace(/\/[^\s:]+(?:\/[^\s:]+)*/gu, "<path>")
    .replace(/:\d+:\d+/gu, ":<line>:<column>")
    .replace(/\b\d+ms\b/gu, "<duration>")
    .toLowerCase()
    .trim();
}

function stableHex(input: string): string {
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (const character of input) {
    first ^= character.charCodeAt(0);
    first = Math.imul(first, 0x01000193);
    second ^= first;
    second = Math.imul(second, 0x85ebca6b);
  }
  const chunk = (value: number): string => (value >>> 0).toString(16).padStart(8, "0");
  return [
    chunk(first),
    chunk(second),
    chunk(first ^ second),
    chunk(Math.imul(first, 0x9e3779b1)),
    chunk(Math.imul(second, 0xc2b2ae35)),
    chunk(first + second),
    chunk(first - second),
    chunk(second - first)
  ].join("");
}

export function fingerprintFailure(summary: string): string {
  return stableHex(normalizeFailureSummary(summary));
}
