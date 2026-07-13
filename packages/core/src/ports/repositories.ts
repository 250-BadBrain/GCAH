import type {
  ConfigSnapshot,
  Action,
  MemoryEntry,
  Run,
  RunEvent,
  Step
} from "@gcah/shared";

export interface RunRepository {
  create(run: Run): Promise<Run>;
  getById(id: string): Promise<Run | null>;
  findActiveByWorkspace(workspaceId: string): Promise<Run | null>;
  listActive(): Promise<Run[]>;
  update(run: Run): Promise<Run>;
}

export interface StepRepository {
  create(step: Step): Promise<Step>;
  listByRun(runId: string): Promise<Step[]>;
}

export interface ActionRepository {
  create(action: Action): Promise<Action>;
  listByStep(stepId: string): Promise<Action[]>;
}

export interface EventRepository {
  append(event: Omit<RunEvent, "cursor"> & { cursor?: number }): Promise<RunEvent>;
  listAfterCursor(runId: string, cursor: number): Promise<RunEvent[]>;
}

export interface MemoryRepository {
  add(entry: MemoryEntry): Promise<MemoryEntry>;
  search(query: { workspaceId: string; query: string; tags?: string[]; limit?: number }): Promise<MemoryEntry[]>;
}

export interface ConfigRepository {
  createSnapshot(snapshot: ConfigSnapshot): Promise<ConfigSnapshot>;
  getSnapshot(id: string): Promise<ConfigSnapshot | null>;
}

export interface RepositorySet {
  runs: RunRepository;
  steps: StepRepository;
  actions: ActionRepository;
  events: EventRepository;
  memory: MemoryRepository;
  config: ConfigRepository;
}

export interface UnitOfWork {
  readonly repositories: RepositorySet;
  transaction<T>(work: (repositories: RepositorySet) => Promise<T>): Promise<T>;
}
