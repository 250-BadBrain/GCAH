import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { openSqliteRepositories } from "../src/index.js";
import { FakeClock, repositoryContract, run, timestamp } from "./repository-contract.js";

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
});
