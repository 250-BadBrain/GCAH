import type {
  ConfigSnapshot,
  MemoryEntry,
  Run,
  RunEvent
} from "@gcah/shared";
import type {
  Clock,
  ConfigRepository,
  EventRepository,
  MemoryRepository,
  RepositorySet,
  RunRepository,
  UnitOfWork
} from "@gcah/core";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isActive(run: Run): boolean {
  return ["PENDING", "RUNNING", "WAITING_APPROVAL"].includes(run.status);
}

export interface InMemoryRepositories extends UnitOfWork {
  reset(): void;
}

export function createInMemoryRepositories(clock: Clock): InMemoryRepositories {
  void clock;
  const runs = new Map<string, Run>();
  const events = new Map<string, RunEvent[]>();
  const memory = new Map<string, MemoryEntry>();
  const configs = new Map<string, ConfigSnapshot>();

  const runRepository: RunRepository = {
    async create(run) {
      if (isActive(run)) {
        for (const existing of runs.values()) {
          if (existing.workspaceId === run.workspaceId && isActive(existing)) {
            throw new Error(`workspace ${run.workspaceId} already has an active run`);
          }
        }
      }
      runs.set(run.id, clone(run));
      return clone(run);
    },
    async getById(id) {
      const run = runs.get(id);
      return run === undefined ? null : clone(run);
    },
    async findActiveByWorkspace(workspaceId) {
      for (const run of runs.values()) {
        if (run.workspaceId === workspaceId && isActive(run)) {
          return clone(run);
        }
      }
      return null;
    },
    async update(run) {
      if (!runs.has(run.id)) {
        throw new Error(`run ${run.id} does not exist`);
      }
      if (isActive(run)) {
        for (const existing of runs.values()) {
          if (existing.id !== run.id && existing.workspaceId === run.workspaceId && isActive(existing)) {
            throw new Error(`workspace ${run.workspaceId} already has an active run`);
          }
        }
      }
      runs.set(run.id, clone(run));
      return clone(run);
    }
  };

  const eventRepository: EventRepository = {
    async append(event) {
      const existing = events.get(event.runId) ?? [];
      const persisted = {
        ...event,
        cursor: existing.length + 1
      } satisfies RunEvent;
      existing.push(clone(persisted));
      events.set(event.runId, existing);
      return clone(persisted);
    },
    async listAfterCursor(runId, cursor) {
      return (events.get(runId) ?? [])
        .filter((event) => event.cursor > cursor)
        .map((event) => clone(event));
    }
  };

  const memoryRepository: MemoryRepository = {
    async add(entry) {
      memory.set(entry.id, clone(entry));
      return clone(entry);
    },
    async search(query) {
      const needle = query.query.toLowerCase();
      const tags = new Set(query.tags ?? []);
      const limit = query.limit ?? 10;
      return [...memory.values()]
        .filter((entry) => entry.workspaceId === query.workspaceId)
        .filter((entry) => tags.size === 0 || entry.tags.some((tag) => tags.has(tag)))
        .filter((entry) => {
          const haystack = [entry.summary, ...entry.keywords, ...entry.tags].join(" ").toLowerCase();
          return haystack.includes(needle);
        })
        .slice(0, limit)
        .map((entry) => clone(entry));
    }
  };

  const configRepository: ConfigRepository = {
    async createSnapshot(snapshot) {
      configs.set(snapshot.id, clone(snapshot));
      return clone(snapshot);
    },
    async getSnapshot(id) {
      const snapshot = configs.get(id);
      return snapshot === undefined ? null : clone(snapshot);
    }
  };

  const repositories: RepositorySet = {
    runs: runRepository,
    events: eventRepository,
    memory: memoryRepository,
    config: configRepository
  };

  return {
    repositories,
    async transaction(work) {
      return work(repositories);
    },
    reset() {
      runs.clear();
      events.clear();
      memory.clear();
      configs.clear();
    }
  };
}
