import { describe, expect, it } from "vitest";

import {
  CredentialBackendUnavailableError,
  createCredentialStore,
  validateCredentialBackend,
  type KeychainBackend
} from "../src/index.js";

const timestamp = "2026-07-14T00:00:00.000Z";

class FakeKeychainBackend implements KeychainBackend {
  private value: string | null = null;

  constructor(private readonly backendId: string) {}

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

class ThrowingDiagnoseBackend implements KeychainBackend {
  async diagnose(): Promise<{ id: string }> {
    throw new Error("locked backend leaked sk-test-sentinel");
  }

  async getPassword(): Promise<string | null> {
    return null;
  }

  async setPassword(): Promise<void> {}

  async deletePassword(): Promise<void> {}
}

class ThrowingOperationBackend implements KeychainBackend {
  async diagnose(): Promise<{ id: string }> {
    return { id: "native-windows" };
  }

  async getPassword(): Promise<string | null> {
    throw new Error("get leaked sk-test-sentinel");
  }

  async setPassword(): Promise<void> {
    throw new Error("set leaked sk-test-sentinel");
  }

  async deletePassword(): Promise<void> {
    throw new Error("delete leaked sk-test-sentinel");
  }
}

describe("CredentialStore", () => {
  it("allows only platform OS credential backends and rejects file/null/unknown", () => {
    expect(validateCredentialBackend("win32", "native-windows")).toEqual({ ok: true });
    expect(validateCredentialBackend("win32", "windows")).toEqual({ ok: true });
    expect(validateCredentialBackend("darwin", "native-macos")).toEqual({ ok: true });
    expect(validateCredentialBackend("darwin", "macos")).toEqual({ ok: true });
    expect(validateCredentialBackend("linux", "native-linux")).toEqual({ ok: true });
    expect(validateCredentialBackend("linux", "secret-service")).toEqual({ ok: true });

    for (const backend of ["file", "null", "unknown"]) {
      expect(validateCredentialBackend("win32", backend)).toEqual({
        ok: false,
        reason: "backend-unavailable"
      });
    }
  });

  it("stores, updates, clears, and reports status without returning plaintext", async () => {
    const backend = new FakeKeychainBackend("native-windows");
    const store = createCredentialStore({
      backend,
      platform: "win32",
      clock: () => timestamp
    });

    await expect(store.status("openai-compatible")).resolves.toEqual({
      available: false,
      provider: "openai-compatible",
      source: "os",
      reason: "missing",
      backend: "native-windows",
      updatedAt: null
    });
    await store.set("openai-compatible", "sk-test-sentinel");
    await expect(store.status("openai-compatible")).resolves.toEqual({
      available: true,
      provider: "openai-compatible",
      source: "os",
      backend: "native-windows",
      updatedAt: timestamp
    });
    await store.update("openai-compatible", "sk-test-updated");
    await expect(store.withCredential("openai-compatible", async (secret) => secret.length)).resolves.toBe("sk-test-updated".length);
    await store.clear("openai-compatible");
    await expect(store.status("openai-compatible")).resolves.toMatchObject({ available: false, reason: "missing" });
  });

  it("fails closed when the backend is unavailable", async () => {
    const store = createCredentialStore({
      backend: new FakeKeychainBackend("file"),
      platform: "win32",
      clock: () => timestamp
    });

    await expect(store.set("openai-compatible", "sk-test-sentinel")).rejects.toBeInstanceOf(CredentialBackendUnavailableError);
    await expect(store.status("openai-compatible")).resolves.toMatchObject({
      available: false,
      reason: "backend-unavailable"
    });
  });

  it("maps locked or unavailable backend exceptions to safe backend-unavailable errors", async () => {
    const store = createCredentialStore({
      backend: new ThrowingDiagnoseBackend(),
      platform: "win32",
      clock: () => timestamp
    });

    await expect(store.set("openai-compatible", "sk-test-sentinel")).rejects.toMatchObject({
      name: "CredentialBackendUnavailableError",
      message: "credential backend unavailable: unknown"
    });
    await expect(store.withCredential("openai-compatible", async () => "unused")).rejects.not.toThrow("sk-test-sentinel");
    await expect(store.status("openai-compatible")).resolves.toMatchObject({
      available: false,
      reason: "backend-unavailable"
    });
  });

  it("maps backend operation exceptions without leaking plaintext", async () => {
    const store = createCredentialStore({
      backend: new ThrowingOperationBackend(),
      platform: "win32",
      clock: () => timestamp
    });

    for (const operation of [
      () => store.set("openai-compatible", "sk-test-sentinel"),
      () => store.update("openai-compatible", "sk-test-sentinel"),
      () => store.clear("openai-compatible"),
      () => store.withCredential("openai-compatible", async () => "unused")
    ]) {
      await expect(operation()).rejects.toMatchObject({
        name: "CredentialBackendUnavailableError",
        message: "credential backend unavailable: native-windows"
      });
      await expect(operation()).rejects.not.toThrow("sk-test-sentinel");
    }
    await expect(store.status("openai-compatible")).resolves.toMatchObject({
      available: false,
      reason: "backend-unavailable"
    });
  });
});
