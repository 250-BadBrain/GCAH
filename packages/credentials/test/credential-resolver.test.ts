import { describe, expect, it } from "vitest";

import { CredentialMissingError, createCredentialResolver, type CredentialStore } from "../src/index.js";

function fakeStore(secret: string | null): CredentialStore {
  return {
    async status(provider) {
      return secret === null
        ? { available: false, provider, source: "os", reason: "missing", backend: "native-windows", updatedAt: null }
        : { available: true, provider, source: "os", backend: "native-windows", updatedAt: null };
    },
    async set() {},
    async update() {},
    async clear() {},
    async withCredential(_provider, callback) {
      if (secret === null) throw new CredentialMissingError("openai-compatible");
      return callback(secret);
    }
  };
}

describe("CredentialResolver", () => {
  it("uses OS store before explicitly enabled environment and dotenv sources", async () => {
    const resolver = createCredentialResolver({
      osStore: fakeStore("sk-os"),
      environment: { enabled: true, values: { OPENAI_COMPATIBLE_API_KEY: "sk-env" } },
      dotenv: { enabled: true, values: { OPENAI_COMPATIBLE_API_KEY: "sk-dotenv" } }
    });

    await expect(resolver.withCredential("openai-compatible", async (secret) => secret)).resolves.toBe("sk-os");
  });

  it("requires explicit opt-in for environment and dotenv plaintext sources", async () => {
    await expect(createCredentialResolver({
      osStore: fakeStore(null),
      environment: { enabled: false, values: { OPENAI_COMPATIBLE_API_KEY: "sk-env" } },
      dotenv: { enabled: true, values: { OPENAI_COMPATIBLE_API_KEY: "sk-dotenv" } }
    }).withCredential("openai-compatible", async (secret) => secret)).resolves.toBe("sk-dotenv");

    await expect(createCredentialResolver({
      osStore: fakeStore(null),
      environment: { enabled: false, values: { OPENAI_COMPATIBLE_API_KEY: "sk-env" } },
      dotenv: { enabled: false, values: { OPENAI_COMPATIBLE_API_KEY: "sk-dotenv" } }
    }).withCredential("openai-compatible", async (secret) => secret)).rejects.toBeInstanceOf(CredentialMissingError);
  });
});
