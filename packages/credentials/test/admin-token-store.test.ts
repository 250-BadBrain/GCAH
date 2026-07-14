import { describe, expect, it } from "vitest";

import { createCredentialBackedAdminTokenStore, type CredentialStore } from "../src/index.js";

describe("CredentialBackedAdminTokenStore", () => {
  it("compares admin tokens only inside the credential callback", async () => {
    const calls: string[] = [];
    const store: CredentialStore = {
      async status(provider) {
        return { available: true, provider, source: "os", backend: "native-windows", updatedAt: null };
      },
      async set() {},
      async update() {},
      async clear() {},
      async withCredential(provider, callback) {
        calls.push(provider);
        return callback("admin-secret");
      }
    };

    const admin = createCredentialBackedAdminTokenStore(store);

    await expect(admin.verify("wrong")).resolves.toBe(false);
    await expect(admin.verify("admin-secret")).resolves.toBe(true);
    expect(calls).toEqual(["admin-token", "admin-token"]);
  });
});
