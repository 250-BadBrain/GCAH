import { describe, expect, it } from "vitest";

import { runCli } from "../src/main.js";
import type { CredentialStore } from "@gcah/credentials";

describe("CLI credential commands", () => {
  it("sets, updates, clears, and statuses credentials without echoing secrets", async () => {
    const calls: string[] = [];
    let configured = false;
    const store: CredentialStore = {
      async status(provider) {
        return configured
          ? { available: true, provider, source: "os", backend: "native-windows", updatedAt: "2026-07-14T00:00:00.000Z" }
          : { available: false, provider, source: "os", reason: "missing", backend: "native-windows", updatedAt: null };
      },
      async set(_provider, secret) {
        calls.push(`set:${secret}`);
        configured = true;
      },
      async update(_provider, secret) {
        calls.push(`update:${secret}`);
        configured = true;
      },
      async clear() {
        calls.push("clear");
        configured = false;
      },
      async withCredential() {
        throw new Error("not used");
      }
    };

    await expect(runCli(["credential", "set"], { credentialStore: store, promptSecret: async () => "sk-test-sentinel" })).resolves.toMatchObject({ stdout: "credential stored\n" });
    await expect(runCli(["credential", "status", "--provider", "openai-compatible"], { credentialStore: store })).resolves.toMatchObject({ stdout: "openai-compatible configured backend=native-windows\n" });
    await expect(runCli(["credential", "status", "--provider", "other"], { credentialStore: store })).resolves.toMatchObject({ stderr: "unsupported credential provider\n", exitCode: 2 });
    await expect(runCli(["credential", "update"], { credentialStore: store, promptSecret: async () => "sk-test-updated" })).resolves.toMatchObject({ stdout: "credential updated\n" });
    await expect(runCli(["credential", "clear"], { credentialStore: store })).resolves.toMatchObject({ stdout: "credential cleared\n" });

    expect(calls).toEqual(["set:sk-test-sentinel", "update:sk-test-updated", "clear"]);
    for (const result of [
      await runCli(["credential", "set"], { credentialStore: store, promptSecret: async () => "sk-test-sentinel" }),
      await runCli(["credential", "update"], { credentialStore: store, promptSecret: async () => "sk-test-updated" })
    ]) {
      expect(result.stdout + result.stderr).not.toContain("sk-test");
    }
  });
});
