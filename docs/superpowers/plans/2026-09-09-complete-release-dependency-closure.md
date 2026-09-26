# Complete Release Dependency Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the portable Windows release contains every transitive runtime dependency required by the local Fastify session.

**Architecture:** pnpm deploy stores direct and transitive packages under its virtual store. The packaging script will materialize both root entries and every package's virtual-store `node_modules` entry at the release root, then discard pnpm links. The relocation smoke test will execute the real `local` command with a temporary workspace so Fastify loads `@fastify/ajv-compiler` and Ajv.

**Tech Stack:** Node.js ESM, pnpm deploy, Fastify, Windows portable launcher.

## Global Constraints

- Release package contains no Junctions or symbolic links.
- `gcah.exe local` must not fail because a runtime module is missing.
- The source and submission copy use the same packaging script.

---

### Task 1: Materialize transitive virtual-store dependencies

**Files:**
- Modify: `scripts/package-win-exe.mjs:120-162`

**Interfaces:**
- Consumes: `app/node_modules/.pnpm/*/node_modules` package entries.
- Produces: physical package copies at `app/node_modules/<package>`.

- [ ] **Step 1: Add virtual-store package discovery**

Enumerate every directory below `node_modules/.pnpm`; for each directory containing `node_modules`, call the existing dependency materializer with that nested directory as source and the release root `node_modules` as target.

```js
for (const entry of readdirSync(virtualStoreDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const nested = join(virtualStoreDir, entry.name, "node_modules");
  if (existsSync(nested)) materializeDependencies(nested, nodeModulesDir);
}
```

- [ ] **Step 2: Build the Windows release**

Run: `pnpm package:win`

Expected: exit code 0 with a physical `ajv` package under release `app/node_modules`.

### Task 2: Exercise the Fastify startup path after relocation

**Files:**
- Modify: `scripts/package-win-exe.mjs:163-182`

**Interfaces:**
- Consumes: relocated `gcah.exe` and a temporary empty workspace.
- Produces: a packaging failure when a local-session runtime dependency is absent.

- [ ] **Step 1: Add a real local-command smoke test**

Invoke relocated `gcah.exe local --workspace <temporary workspace> --base-url http://127.0.0.1:1 --model test --validation none --task smoke`. Treat exit code zero or the expected credential/configuration exit as success only after Fastify has loaded; module resolution errors must fail the package build.

- [ ] **Step 2: Rebuild from `E:\Downloads\lab1\GCAH-submission` using `powershell.exe`**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Release.ps1`

Expected: release package builds without `Cannot find module 'ajv/dist/jtd'`.

- [ ] **Step 3: Launch `Start GCAH.cmd` manually or run `gcah.exe local`**

Expected: interactive `gcah>` prompt appears without module-resolution errors.
