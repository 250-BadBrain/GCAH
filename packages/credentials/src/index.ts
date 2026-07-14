export {
  createCredentialBackedAdminTokenStore,
  type AdminTokenStore
} from "./admin-token-store.js";
export {
  createCredentialResolver,
  type CredentialResolver,
  type CreateCredentialResolverInput
} from "./credential-resolver.js";
export {
  readPlaintextSource,
  type PlaintextSource,
  type SecretSourceValues
} from "./environment-source.js";
export { createOsKeychainBackend } from "./os-store.js";
export {
  CredentialBackendUnavailableError,
  CredentialMissingError,
  createCredentialStore,
  validateCredentialBackend,
  type BackendValidationResult,
  type CreateCredentialStoreInput,
  type CredentialProvider,
  type CredentialStatus,
  type CredentialStore,
  type KeychainBackend
} from "./store.js";
