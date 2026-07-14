import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import type { Clock, RepositorySet, UnitOfWork } from "@gcah/core";
import type { Action, ConfigSnapshot, MemoryEntry, Run, RunEvent, Step } from "@gcah/shared";

export interface OpenSqliteRepositoriesInput {
  dataDir: string;
  clock: Clock;
}

export interface SqliteRepositories extends UnitOfWork {
  close(): void;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function encode(value: unknown): string {
  return JSON.stringify(value);
}

function decode<T>(row: Record<string, unknown> | undefined): T | null {
  if (row === undefined || typeof row.json !== "string") return null;
  return JSON.parse(row.json) as T;
}

function isActive(run: Run): boolean {
  return ["PENDING", "RUNNING", "WAITING_APPROVAL"].includes(run.status);
}

function isSqliteConstraint(error: unknown, constraint: string): boolean {
  return String(error).toUpperCase().includes(constraint);
}

function migrationSql(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return readFileSync(join(currentFile, "..", "migrations", "001-initial.sql"), "utf8");
}

export function openSqliteRepositories(input: OpenSqliteRepositoriesInput): SqliteRepositories {
  mkdirSync(input.dataDir, { recursive: true });
  const db = new DatabaseSync(join(input.dataDir, "gcah.sqlite"));
  db.exec(migrationSql());

  function activeRunForWorkspace(workspaceId: string, exceptRunId?: string): Run | null {
    const rows = db.prepare("SELECT json FROM runs WHERE workspace_id = ?").all(workspaceId);
    for (const row of rows) {
      const existing = decode<Run>(row);
      if (existing !== null && existing.id !== exceptRunId && isActive(existing)) return existing;
    }
    return null;
  }

  const repositories: RepositorySet = {
    runs: {
      async create(run) {
        if (isActive(run) && activeRunForWorkspace(run.workspaceId) !== null) {
          throw new Error(`workspace ${run.workspaceId} already has an active run`);
        }
        try {
          db.prepare("INSERT INTO runs(id, workspace_id, status, json) VALUES (?, ?, ?, ?)").run(run.id, run.workspaceId, run.status, encode(run));
        } catch (error) {
          if (isSqliteConstraint(error, "UNIQUE")) throw new Error(`workspace ${run.workspaceId} already has an active run`);
          throw error;
        }
        return clone(run);
      },
      async getById(id) {
        return clone(decode<Run>(db.prepare("SELECT json FROM runs WHERE id = ?").get(id)));
      },
      async findActiveByWorkspace(workspaceId) {
        return clone(activeRunForWorkspace(workspaceId));
      },
      async listActive() {
        return db.prepare("SELECT json FROM runs").all()
          .map((row) => decode<Run>(row))
          .filter((run): run is Run => run !== null && isActive(run))
          .map((run) => clone(run));
      },
      async update(run) {
        if (isActive(run) && activeRunForWorkspace(run.workspaceId, run.id) !== null) {
          throw new Error(`workspace ${run.workspaceId} already has an active run`);
        }
        const result = db.prepare("UPDATE runs SET workspace_id = ?, status = ?, json = ? WHERE id = ?").run(run.workspaceId, run.status, encode(run), run.id);
        if (result.changes === 0) throw new Error(`run ${run.id} does not exist`);
        return clone(run);
      }
    },
    steps: {
      async create(step) {
        try {
          db.prepare("INSERT INTO steps(id, run_id, sequence, json) VALUES (?, ?, ?, ?)").run(step.id, step.runId, step.sequence, encode(step));
        } catch (error) {
          if (isSqliteConstraint(error, "FOREIGN KEY")) throw new Error(`run ${step.runId} does not exist`);
          if (isSqliteConstraint(error, "UNIQUE")) throw new Error(`duplicate step sequence ${step.sequence} for run ${step.runId}`);
          throw error;
        }
        return clone(step);
      },
      async listByRun(runId) {
        return db.prepare("SELECT json FROM steps WHERE run_id = ? ORDER BY sequence ASC").all(runId)
          .map((row) => decode<Step>(row))
          .filter((step): step is Step => step !== null)
          .map((step) => clone(step));
      }
    },
    actions: {
      async create(action) {
        try {
          db.prepare("INSERT INTO actions(id, step_id, json) VALUES (?, ?, ?)").run(action.id, action.stepId, encode(action));
        } catch (error) {
          if (isSqliteConstraint(error, "FOREIGN KEY")) throw new Error(`step ${action.stepId} does not exist`);
          throw error;
        }
        return clone(action);
      },
      async listByStep(stepId) {
        return db.prepare("SELECT json FROM actions WHERE step_id = ? ORDER BY id ASC").all(stepId)
          .map((row) => decode<Action>(row))
          .filter((action): action is Action => action !== null)
          .map((action) => clone(action));
      }
    },
    events: {
      async append(event) {
        const row = db.prepare("SELECT COALESCE(MAX(cursor), 0) AS cursor FROM events WHERE run_id = ?").get(event.runId);
        const nextCursor = Number(row?.cursor ?? 0) + 1;
        const persisted = { ...event, cursor: nextCursor } satisfies RunEvent;
        try {
          db.prepare("INSERT INTO events(id, run_id, step_id, cursor, json) VALUES (?, ?, ?, ?, ?)").run(
            persisted.id,
            persisted.runId,
            persisted.stepId,
            persisted.cursor,
            encode(persisted)
          );
        } catch (error) {
          if (isSqliteConstraint(error, "FOREIGN KEY")) {
            if (persisted.stepId !== null) throw new Error(`step ${persisted.stepId} does not exist`);
            throw new Error(`run ${persisted.runId} does not exist`);
          }
          throw error;
        }
        return clone(persisted);
      },
      async listAfterCursor(runId, cursor) {
        return db.prepare("SELECT json FROM events WHERE run_id = ? AND cursor > ? ORDER BY cursor ASC").all(runId, cursor)
          .map((row) => decode<RunEvent>(row))
          .filter((event): event is RunEvent => event !== null)
          .map((event) => clone(event));
      }
    },
    memory: {
      async add(entry) {
        db.prepare("INSERT INTO memory_entries(id, workspace_id, summary, json) VALUES (?, ?, ?, ?)").run(entry.id, entry.workspaceId, entry.summary, encode(entry));
        return clone(entry);
      },
      async search(query) {
        const needle = query.query.toLowerCase();
        const tags = new Set(query.tags ?? []);
        const limit = query.limit ?? 10;
        return db.prepare("SELECT json FROM memory_entries WHERE workspace_id = ? ORDER BY id ASC").all(query.workspaceId)
          .map((row) => decode<MemoryEntry>(row))
          .filter((entry): entry is MemoryEntry => entry !== null)
          .filter((entry) => tags.size === 0 || entry.tags.some((tag) => tags.has(tag)))
          .filter((entry) => [entry.summary, ...entry.keywords, ...entry.tags].join(" ").toLowerCase().includes(needle))
          .slice(0, limit)
          .map((entry) => clone(entry));
      }
    },
    config: {
      async createSnapshot(snapshot) {
        db.prepare("INSERT INTO config_snapshots(id, json) VALUES (?, ?)").run(snapshot.id, encode(snapshot));
        return clone(snapshot);
      },
      async getSnapshot(id) {
        return clone(decode<ConfigSnapshot>(db.prepare("SELECT json FROM config_snapshots WHERE id = ?").get(id)));
      }
    }
  };

  return {
    repositories,
    async transaction(work) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = await work(repositories);
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    close() {
      db.close();
    }
  };
}
