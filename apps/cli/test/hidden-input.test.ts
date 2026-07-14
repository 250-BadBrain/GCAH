import { describe, expect, it } from "vitest";

import { createHiddenInputPrompt, runMain } from "../src/main.js";
import type { CredentialStore } from "@gcah/credentials";

describe("CLI hidden input and entrypoint", () => {
  it("reads secret input without writing it to output", async () => {
    const writes: string[] = [];
    const prompt = createHiddenInputPrompt({
      read: async () => "sk-test-sentinel\n",
      write: (value) => writes.push(value)
    });

    await expect(prompt()).resolves.toBe("sk-test-sentinel");
    expect(writes.join("")).not.toContain("sk-test-sentinel");
  });

  it("runs argv through the executable entrypoint dependencies", async () => {
    let stored = "";
    const store: CredentialStore = {
      async status(provider) {
        return { available: true, provider, source: "os", backend: "native-windows", updatedAt: null };
      },
      async set(_provider, secret) {
        stored = secret;
      },
      async update() {},
      async clear() {},
      async withCredential() {
        throw new Error("not used");
      }
    };
    const output = await runMain(["credential", "set"], {
      credentialStore: store,
      promptSecret: async () => "sk-test-sentinel"
    });

    expect(output.exitCode).toBe(0);
    expect(output.stdout + output.stderr).not.toContain("sk-test-sentinel");
    expect(stored).toBe("sk-test-sentinel");
  });
});
