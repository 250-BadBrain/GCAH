import { describe, expect, it } from "vitest";

import { CredentialBackendUnavailableError, CredentialMissingError, createCredentialStore, type KeychainBackend } from "../src/index.js";

class SentinelBackend implements KeychainBackend {
  constructor(private readonly backendId: string, private value: string | null) {}

  async diagnose(): Promise<{ id: string }> {
    return { id: this.backendId };
  }

  async getPassword(): Promise<string | null> {
    return this.value;
  }

  async setPassword(_service: string, _account: string, secret: string): Promise<void> {
    this.value = secret;
  }

  async deletePassword(): Promise<void> {
    this.value = null;
  }
}

describe("credential secret isolation", () => {
  it("does not serialize sentinels in status or errors", async () => {
    const sentinel = "sk-test-sentinel-do-not-persist";
    const store = createCredentialStore({
      backend: new SentinelBackend("native-windows", sentinel),
      platform: "win32",
      clock: () => "2026-07-14T00:00:00.000Z"
    });

    const status = await store.status("openai-compatible");
    expect(JSON.stringify(status)).not.toContain(sentinel);

    const unavailable = new CredentialBackendUnavailableError("file");
    const missing = new CredentialMissingError("openai-compatible");
    expect(JSON.stringify(unavailable)).not.toContain(sentinel);
    expect(unavailable.message).not.toContain(sentinel);
    expect(JSON.stringify(missing)).not.toContain(sentinel);
  });
});
