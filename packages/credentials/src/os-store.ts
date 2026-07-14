import { deletePassword, diagnose, getPassword, setPassword } from "cross-keychain";

import type { KeychainBackend } from "./store.js";

export function createOsKeychainBackend(): KeychainBackend {
  return {
    async diagnose() {
      const info = await diagnose();
      const id = typeof info.id === "string" ? info.id : "unknown";
      return { id };
    },
    getPassword,
    setPassword,
    deletePassword
  };
}
