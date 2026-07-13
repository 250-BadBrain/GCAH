export interface RationaleDisplayPolicy {
  readonly maxLength: number;
}

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]+/gu,
  /(api[_-]?key\s*=\s*)[^\s<>"']+/giu
];

const PATH_PATTERNS = [
  /[A-Za-z]:\/Users\/[^\s<>"']+/gu,
  /[A-Za-z]:\\Users\\[^\s<>"']+/gu,
  /\/home\/[^\s<>"']+/gu
];

export function sanitizeRationale(input: string, policy: RationaleDisplayPolicy): string {
  const escaped = input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

  const redactedSecrets = SECRET_PATTERNS.reduce(
    (value, pattern) => value.replace(pattern, (match, prefix: string | undefined) => {
      return prefix === undefined ? "[REDACTED]" : `${prefix}[REDACTED]`;
    }),
    escaped
  );

  const redacted = PATH_PATTERNS.reduce(
    (value, pattern) => value.replace(pattern, "[REDACTED_PATH]"),
    redactedSecrets
  );

  if (redacted.length <= policy.maxLength) {
    return redacted;
  }

  return `${redacted.slice(0, Math.max(0, policy.maxLength - 3))}...`;
}
