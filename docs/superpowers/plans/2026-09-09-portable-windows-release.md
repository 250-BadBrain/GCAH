# Portable Windows Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a Windows release folder that can be moved anywhere without retaining pnpm Junctions to the build machine.

**Architecture:** `pnpm deploy` creates its normal linked dependency layout. The packaging script then replaces every root-level runtime dependency with a physical copy and removes pnpm's virtual store and command links, so all runtime modules are physical files within the release folder. A post-package verification will fail the build if any reparse-point directory remains or if the packaged CLI cannot resolve its direct dependencies.

**Tech Stack:** Node.js ESM, pnpm deploy, Windows Junction detection, PowerShell smoke test.

## Global Constraints

- Windows release output remains `release/gcah-windows-x64`.
- `gcah.exe`, `runtime/node.exe`, `Start GCAH.cmd`, checksums, and the existing user-facing README remain part of the package.
- The package must contain no directory links/Junctions under `app/node_modules`.
- The test must launch the package after it has been copied outside the repository tree.

---

### Task 1: Materialize the deployed dependency tree

**Files:**
- Modify: `scripts/package-win-exe.mjs:1-180`

**Interfaces:**
- Consumes: `pnpm --filter @gcah/cli deploy <directory> --legacy --frozen-lockfile` output.
- Produces: `release/gcah-windows-x64/app`, a directory tree with no symbolic links or Junctions.

- [ ] **Step 1: Add a failing post-package link assertion**

Add an `assertNoDirectoryLinks(root)` helper that recursively reads directories with `lstatSync`, and throws an error that includes the linked path when `stats.isSymbolicLink()` is true.

```js
function assertNoDirectoryLinks(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (lstatSync(path).isSymbolicLink()) throw new Error(`Release package contains linked directory: ${path}`);
    if (entry.isDirectory()) assertNoDirectoryLinks(path);
  }
}
```

- [ ] **Step 2: Run `pnpm package:win` to verify the assertion fails on the current linked deployment**

Run: `pnpm package:win`

Expected: command exits non-zero and identifies a link below `release/gcah-windows-x64/app/node_modules`.

- [ ] **Step 3: Materialize each root dependency and remove pnpm links**

After deployment, resolve every non-`.pnpm` root package in `app/node_modules`, delete its Junction, and copy the resolved package contents while excluding its nested `node_modules`. Then remove `.pnpm` and `.bin`; Node can resolve every runtime dependency through the resulting physical, flat root `node_modules` tree. Run `assertNoDirectoryLinks(appDir)` afterwards.

```js
execFileSync("pnpm", ["--filter", "@gcah/cli", "deploy", appDir, "--legacy", "--frozen-lockfile"], { /* existing options */ });
materializeRootDependencies(join(appDir, "node_modules"));
assertNoDirectoryLinks(appDir);
```

- [ ] **Step 4: Run the build to verify the materialized package is created**

Run: `pnpm package:win`

Expected: exit code 0 and `release/gcah-windows-x64/app` exists without Junctions.

- [ ] **Step 5: Commit**

```powershell
git add scripts/package-win-exe.mjs
git commit -m "fix: materialize Windows release dependencies"
```

### Task 2: Verify release relocation and module resolution

**Files:**
- Modify: `scripts/package-win-exe.mjs:1-180`

**Interfaces:**
- Consumes: finished `release/gcah-windows-x64` package.
- Produces: a packaging failure if the package cannot load the CLI after relocation.

- [ ] **Step 1: Add a portable-package verification helper**

After generating the package, copy it to a uniquely named temporary directory with `cpSync(..., { recursive: true, dereference: true })`. Invoke its bundled `runtime/node.exe` against the copied `app/dist/src/bin.js` with `credential status`, and require a zero exit code. Clean the temporary package directory in `finally`.

```js
const verificationRoot = mkdtempSync(join(tmpdir(), "gcah-release-"));
const relocatedPackage = join(verificationRoot, "moved-package");
try {
  cpSync(packageDir, relocatedPackage, { recursive: true, dereference: true });
  execFileSync(join(relocatedPackage, "gcah.exe"), ["credential", "status"], { stdio: "inherit" });
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run `pnpm package:win` and verify the relocated smoke test succeeds**

Run: `pnpm package:win`

Expected: exit code 0; the temporary copied package loads `@gcah/credentials` instead of throwing `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Manually inspect the completed release folder**

Run: `Get-ChildItem -Recurse -Force release/gcah-windows-x64/app/node_modules | Where-Object { $_.LinkType -ne $null }`

Expected: no Junction or SymbolicLink entries.

- [ ] **Step 4: Commit**

```powershell
git add scripts/package-win-exe.mjs
git commit -m "test: verify Windows release relocation"
```
