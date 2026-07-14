import { describe, expect, it } from "vitest";

import { runCli } from "../src/main.js";
import type { CredentialStore } from "@gcah/credentials";

describe("CLI server commands", () => {
  it("prints local server start guidance and backend unavailable errors", async () => {
    await expect(runCli(["server", "start"])).resolves.toMatchObject({
      stdout: "server start: use @gcah/server composition root\n"
    });
    const unavailableStore: CredentialStore = {
      async status(provider) {
        return { available: false, provider, source: "os", reason: "backend-unavailable", updatedAt: null };
      },
      async set() {},
      async update() {},
      async clear() {},
      async withCredential() {
        throw new Error("backend unavailable");
      }
    };
    await expect(runCli(["credential", "status"], { credentialStore: unavailableStore })).resolves.toMatchObject({
      stderr: "credential backend unavailable\n",
      exitCode: 2
    });
  });
});
