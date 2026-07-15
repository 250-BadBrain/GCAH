import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("mechanism demo command", () => {
  it("emits deterministic course mechanism markers", async () => {
    const first = await runDemo();
    const second = await runDemo();

    for (const marker of [
      "DANGEROUS_ACTION_DENIED",
      "VALIDATION_FAILED",
      "MOCK_ACTION_CHANGED",
      "SESSION_GRANT_EXPIRED",
      "REAPPROVAL_REQUIRED"
    ]) {
      expect(first.stdout).toContain(marker);
    }
    expect(JSON.parse(first.stdout)).toEqual(JSON.parse(second.stdout));
  });
});

async function runDemo(): Promise<{ stdout: string }> {
  if (process.platform === "win32") {
    return execFileAsync("powershell", ["-NoProfile", "-Command", "pnpm run demo:mechanisms"], { cwd: process.cwd() });
  }
  return execFileAsync("pnpm", ["run", "demo:mechanisms"], { cwd: process.cwd() });
}
