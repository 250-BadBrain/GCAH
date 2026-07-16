import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { openSqliteRepositories } from "../src/index.js";
import { configSnapshot, FakeClock, repositoryContract, run, timestamp } from "./repository-contract.js";

repositoryContract({
  name: "sqlite",
  create: async () => openSqliteRepositories({ dataDir: await mkdtemp(join(tmpdir(), "gcah-sqlite-")), clock: new FakeClock() })
});

describe("sqlite repositories", () => {
  it("rolls back a transaction when event persistence fails", async () => {
    const store = await openSqliteRepositories({ dataDir: await mkdtemp(join(tmpdir(), "gcah-sqlite-")), clock: new FakeClock() });
    try {
      await expect(store.transaction(async (repositories) => {
        await repositories.runs.create(run("run-rollback"));
        await repositories.events.append({
          id: "event-secret",
          runId: "run-rollback",
          stepId: null,
          type: "run.started",
          relatedEntityId: null,
          summary: "started",
          createdAt: timestamp
        });
        await repositories.events.append({
          id: "event-secret",
          runId: "run-rollback",
          stepId: null,
          type: "run.duplicate",
          relatedEntityId: null,
          summary: "should rollback",
          createdAt: timestamp
        });
      })).rejects.toThrow();

      await expect(store.repositories.runs.getById("run-rollback")).resolves.toBeNull();
    } finally {
      store.close();
    }
  });

  it("does not persist credential sentinels in database text", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "gcah-sqlite-"));
    const store = await openSqliteRepositories({ dataDir, clock: new FakeClock() });
    try {
      await store.repositories.runs.create(run("run-safe"));
    } finally {
      store.close();
    }
    await expect(readFile(join(dataDir, "gcah.sqlite"), "utf8")).resolves.not.toContain("sk-test-secret");
  });

  it("uses database constraints for active run uniqueness", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "gcah-sqlite-"));
    const store = await openSqliteRepositories({ dataDir, clock: new FakeClock() });
    store.close();

    const db = new DatabaseSync(join(dataDir, "gcah.sqlite"));
    try {
      const indexes = db.prepare("PRAGMA index_list('runs')").all();
      expect(indexes).toContainEqual(expect.objectContaining({
        name: "idx_runs_one_active_per_workspace",
        unique: 1
      }));
    } finally {
      db.close();
    }
  });

  it("allows deterministic config snapshots to be saved repeatedly", async () => {
    const store = await openSqliteRepositories({ dataDir: await mkdtemp(join(tmpdir(), "gcah-sqlite-")), clock: new FakeClock() });
    try {
      await store.repositories.config.createSnapshot(configSnapshot());
      await store.repositories.config.createSnapshot(configSnapshot());

      await expect(store.repositories.config.getSnapshot("config-1")).resolves.toEqual(configSnapshot());
    } finally {
      store.close();
    }
  });
});
