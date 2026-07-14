import type { CredentialStore } from "./store.js";

export interface AdminTokenStore {
  verify(token: string): Promise<boolean>;
}

export function createCredentialBackedAdminTokenStore(store: CredentialStore): AdminTokenStore {
  return {
    async verify(token) {
      return store.withCredential("admin-token", async (expected) => expected === token);
    }
  };
}
