import { readPlaintextSource, type PlaintextSource } from "./environment-source.js";
import { CredentialMissingError, type CredentialProvider, type CredentialStore } from "./store.js";

export interface CredentialResolver {
  withCredential<T>(provider: CredentialProvider, callback: (secret: string) => Promise<T>): Promise<T>;
}

export interface CreateCredentialResolverInput {
  osStore: CredentialStore;
  environment: PlaintextSource;
  dotenv: PlaintextSource;
}

export function createCredentialResolver(input: CreateCredentialResolverInput): CredentialResolver {
  return {
    async withCredential(provider, callback) {
      try {
        return await input.osStore.withCredential(provider, callback);
      } catch (error) {
        if (!(error instanceof CredentialMissingError)) throw error;
      }

      const environmentSecret = readPlaintextSource(input.environment, provider);
      if (environmentSecret !== null) return callback(environmentSecret);

      const dotenvSecret = readPlaintextSource(input.dotenv, provider);
      if (dotenvSecret !== null) return callback(dotenvSecret);

      throw new CredentialMissingError(provider);
    }
  };
}
