import type {
  ConfigSnapshot,
  Action,
  MemoryEntry,
  Run,
  RunEvent,
  Step
} from "@gcah/shared";
import type {
  Clock,
  ActionRepository,
  ConfigRepository,
  EventRepository,
  MemoryRepository,
  RepositorySet,
  RunRepository,
  StepRepository,
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
  const steps = new Map<string, Step>();
  const actions = new Map<string, Action>();
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
    async listActive() {
      return [...runs.values()]
        .filter((run) => isActive(run))
        .map((run) => clone(run));
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
      if (!runs.has(event.runId)) throw new Error(`run ${event.runId} does not exist`);
      if (event.stepId !== null && !steps.has(event.stepId)) throw new Error(`step ${event.stepId} does not exist`);
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

  const stepRepository: StepRepository = {
    async create(step) {
      if (!runs.has(step.runId)) throw new Error(`run ${step.runId} does not exist`);
      for (const existing of steps.values()) {
        if (existing.runId === step.runId && existing.sequence === step.sequence) {
          throw new Error(`duplicate step sequence ${step.sequence} for run ${step.runId}`);
        }
      }
      steps.set(step.id, clone(step));
      return clone(step);
    },
    async listByRun(runId) {
      return [...steps.values()]
        .filter((step) => step.runId === runId)
        .sort((left, right) => left.sequence - right.sequence)
        .map((step) => clone(step));
    }
  };

  const actionRepository: ActionRepository = {
    async create(action) {
      if (!steps.has(action.stepId)) throw new Error(`step ${action.stepId} does not exist`);
      actions.set(action.id, clone(action));
      return clone(action);
    },
    async listByStep(stepId) {
      return [...actions.values()]
        .filter((action) => action.stepId === stepId)
        .map((action) => clone(action));
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
    steps: stepRepository,
    actions: actionRepository,
    events: eventRepository,
    memory: memoryRepository,
    config: configRepository
  };

  return {
    repositories,
    async transaction(work) {
      const backup = {
        runs: clone([...runs.entries()]),
        steps: clone([...steps.entries()]),
        actions: clone([...actions.entries()]),
        events: clone([...events.entries()]),
        memory: clone([...memory.entries()]),
        configs: clone([...configs.entries()])
      };
      try {
        return await work(repositories);
      } catch (error) {
        runs.clear(); for (const [key, value] of backup.runs) runs.set(key, value);
        steps.clear(); for (const [key, value] of backup.steps) steps.set(key, value);
        actions.clear(); for (const [key, value] of backup.actions) actions.set(key, value);
        events.clear(); for (const [key, value] of backup.events) events.set(key, value);
        memory.clear(); for (const [key, value] of backup.memory) memory.set(key, value);
        configs.clear(); for (const [key, value] of backup.configs) configs.set(key, value);
        throw error;
      }
    },
    reset() {
      runs.clear();
      steps.clear();
      actions.clear();
      events.clear();
      memory.clear();
      configs.clear();
    }
  };
}
