export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function ok(stdout: string): CliResult {
  return { stdout: sanitizeOutput(stdout), stderr: "", exitCode: 0 };
}

export function fail(stderr: string, exitCode = 1): CliResult {
  return { stdout: "", stderr: sanitizeOutput(stderr), exitCode };
}

export function sanitizeOutput(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]+/gu, "<redacted>")
    .replace(/api[_-]?key\s*=\s*[^\s]+/giu, "<redacted>");
}
