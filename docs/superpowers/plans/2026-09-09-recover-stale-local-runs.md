# Recover Stale Local Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each new local GCAH server instance mark interrupted database runs as stopped so a restarted interactive session can submit work in the same workspace.

**Architecture:** `createLocalProductionApp` owns the SQLite repository and is the common construction point for local CLI sessions. Invoke the existing `interruptActiveRunsOnStartup` helper immediately after opening that repository and before requests can submit a new run. Cover the behavior through the local-production integration suite using a persistent temporary data directory.

**Tech Stack:** TypeScript, Node.js 22, Fastify, SQLite, Vitest, pnpm.

## Global Constraints

- Preserve completed run history; only runs whose status is active may transition to `INTERRUPTED`.
- Do not add a destructive REPL command or delete the local `.gcah` database.
- A restart must allow a new run in the same registered workspace.
- The packaged Windows executable must be rebuilt and smoke-tested after source tests pass.

---

### Task 1: Define the restart regression test

**Files:**
- Modify: `apps/server/test/local-production.integration.test.ts`
- Modify: `apps/server/src/local-production.ts`

**Interfaces:**
- Consumes: `createLocalProductionApp(options)` and the persisted `dataDir` option.
- Produces: A regression test demonstrating that reopening a local production app interrupts an existing active run.

- [ ] **Step 1: Write the failing test**

Add an integration test that creates an app with a temporary `dataDir`, registers a workspace, creates a run that reaches an active state, closes the app, reopens an app with the same `dataDir`, and asserts the original run is `INTERRUPTED` with stop reason `INTERRUPTED` before submitting a replacement run.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter @gcah/server test -- local-production.integration.test.ts`

Expected: the restart test fails because `createLocalProductionApp` currently opens the persisted database without invoking startup interruption.

- [ ] **Step 3: Implement the minimal startup recovery**

In `apps/server/src/local-production.ts`, import `interruptActiveRunsOnStartup` from `./server.js` and call it after `openSqliteRepositories({ dataDir, clock })`:

```ts
const unitOfWork = openSqliteRepositories({ dataDir: options.dataDir, clock });
await interruptActiveRunsOnStartup({ unitOfWork, clock });
```

This must run before Fastify routes are registered or the returned app can serve a request.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter @gcah/server test -- local-production.integration.test.ts`

Expected: PASS, and the reopened app can create a replacement run for the same workspace.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/local-production.ts apps/server/test/local-production.integration.test.ts
git commit -m "fix: interrupt stale local runs on startup"
```

### Task 2: Verify and deliver the repaired release

**Files:**
- Modify: `scripts/package-win-exe.mjs` only if the existing package verification needs an explicit stale-run assertion.
- Rebuild: `E:\Downloads\lab1\GCAH-submission\release\gcah-windows-x64`

**Interfaces:**
- Consumes: the startup recovery from Task 1 and the existing Windows package script.
- Produces: a portable submission release that does not retain an active workspace lock after restart.

- [ ] **Step 1: Run the relevant source tests**

Run: `pnpm --filter @gcah/server test -- local-production.integration.test.ts restart.test.ts`

Expected: PASS.

- [ ] **Step 2: Rebuild the submission release**

Run: `E:\Downloads\lab1\GCAH-submission\Build-Release.cmd`

Expected: build completes and produces `E:\Downloads\lab1\GCAH-submission\release\gcah-windows-x64\gcah.exe` without a ZIP archive.

- [ ] **Step 3: Smoke-test restart recovery from the packaged executable**

Run `gcah.exe local` with a temporary `--data-dir` and workspace. Start a task that needs approval, terminate the session, reopen the executable with the same data directory, and submit a new task. Confirm it does not return `WORKSPACE_HAS_ACTIVE_RUN`.

- [ ] **Step 4: Commit**

```powershell
git add docs/superpowers/plans/2026-09-09-recover-stale-local-runs.md
git commit -m "docs: plan local run recovery"
```

## Self-Review

- Spec coverage: Task 1 fixes the persisted active-run lock; Task 2 verifies source behavior and the user-facing Windows package.
- Placeholder scan: no TBD, TODO, or unspecified implementation steps remain.
- Type consistency: `interruptActiveRunsOnStartup` accepts the `unitOfWork` and `clock` already created by `createLocalProductionApp`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-09-recover-stale-local-runs.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task and review between tasks.
2. Inline Execution - execute the plan in this session with checkpoints.
