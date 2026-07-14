export type CredentialProvider = "openai-compatible" | "admin-token";
export type CredentialPlatform = "win32" | "darwin" | "linux" | string;

export type CredentialStatus =
  | {
    available: true;
    provider: CredentialProvider;
    source: "os" | "environment" | "dotenv";
    backend: string;
    updatedAt: string | null;
  }
  | {
    available: false;
    provider: CredentialProvider;
    source: "os" | "environment" | "dotenv";
    reason: "missing" | "backend-unavailable";
    backend?: string;
    updatedAt: string | null;
  };

export interface CredentialStore {
  status(provider: CredentialProvider): Promise<CredentialStatus>;
  set(provider: CredentialProvider, secret: string): Promise<void>;
  update(provider: CredentialProvider, secret: string): Promise<void>;
  clear(provider: CredentialProvider): Promise<void>;
  withCredential<T>(provider: CredentialProvider, callback: (secret: string) => Promise<T>): Promise<T>;
}

export interface KeychainBackend {
  diagnose(): Promise<{ id: string }>;
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, secret: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<void>;
}

export class CredentialBackendUnavailableError extends Error {
  constructor(backend: string) {
    super(`credential backend unavailable: ${backend}`);
    this.name = "CredentialBackendUnavailableError";
  }

  toJSON(): { name: string; message: string } {
    return { name: this.name, message: this.message };
  }
}

export class CredentialMissingError extends Error {
  constructor(provider: CredentialProvider) {
    super(`credential missing: ${provider}`);
    this.name = "CredentialMissingError";
  }

  toJSON(): { name: string; message: string } {
    return { name: this.name, message: this.message };
  }
}

export type BackendValidationResult =
  | { ok: true }
  | { ok: false; reason: "backend-unavailable" };

const allowedBackends: Partial<Record<CredentialPlatform, readonly string[]>> = {
  win32: ["native-windows", "windows"],
  darwin: ["native-macos", "macos"],
  linux: ["native-linux", "secret-service"]
};

const accountByProvider: Record<CredentialProvider, string> = {
  "openai-compatible": "openai-compatible",
  "admin-token": "admin-token"
};

export function validateCredentialBackend(platform: CredentialPlatform, backend: string): BackendValidationResult {
  if (allowedBackends[platform]?.includes(backend) === true) return { ok: true };
  return { ok: false, reason: "backend-unavailable" };
}

export interface CreateCredentialStoreInput {
  backend: KeychainBackend;
  platform?: CredentialPlatform;
  service?: string;
  clock?: () => string;
}

export function createCredentialStore(input: CreateCredentialStoreInput): CredentialStore {
  const platform = input.platform ?? currentPlatform();
  const service = input.service ?? "gcah.credentials";
  const clock = input.clock ?? (() => new Date().toISOString());
  const updatedAt = new Map<CredentialProvider, string>();

  async function backendId(): Promise<string> {
    try {
      const diagnosis = await input.backend.diagnose();
      return diagnosis.id;
    } catch {
      throw new CredentialBackendUnavailableError("unknown");
    }
  }

  async function ensureBackend(): Promise<string> {
    const id = await backendId();
    const validation = validateCredentialBackend(platform, id);
    if (!validation.ok) throw new CredentialBackendUnavailableError(id);
    return id;
  }

  async function account(provider: CredentialProvider): Promise<{ backend: string; account: string }> {
    return { backend: await ensureBackend(), account: accountByProvider[provider] };
  }

  return {
    async status(provider) {
      let id: string;
      try {
        id = await ensureBackend();
      } catch {
        return {
          available: false,
          provider,
          source: "os",
          reason: "backend-unavailable",
          updatedAt: null
        };
      }
      const secret = await input.backend.getPassword(service, accountByProvider[provider]);
      if (secret === null) {
        return {
          available: false,
          provider,
          source: "os",
          reason: "missing",
          backend: id,
          updatedAt: null
        };
      }
      return {
        available: true,
        provider,
        source: "os",
        backend: id,
        updatedAt: updatedAt.get(provider) ?? null
      };
    },
    async set(provider, secret) {
      const target = await account(provider);
      await input.backend.setPassword(service, target.account, secret);
      updatedAt.set(provider, clock());
    },
    async update(provider, secret) {
      const target = await account(provider);
      await input.backend.setPassword(service, target.account, secret);
      updatedAt.set(provider, clock());
    },
    async clear(provider) {
      const target = await account(provider);
      await input.backend.deletePassword(service, target.account);
      updatedAt.delete(provider);
    },
    async withCredential(provider, callback) {
      const target = await account(provider);
      const secret = await input.backend.getPassword(service, target.account);
      if (secret === null) throw new CredentialMissingError(provider);
      return callback(secret);
    }
  };
}

function currentPlatform(): CredentialPlatform {
  const processLike = globalThis as typeof globalThis & { process?: { platform?: string } };
  return processLike.process?.platform ?? "unknown";
}
