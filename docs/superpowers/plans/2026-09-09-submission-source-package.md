# Submission Source Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a clean GCAH source submission under `E:\Downloads\lab1\GCAH-submission` that a reviewer can build into a movable Windows executable package by following its README.

**Architecture:** Copy source, documentation, lockfile, and development tests into a new directory without installed dependencies or generated release output. Add a PowerShell build entry point which validates Node and pnpm, installs the frozen lockfile, runs the existing portable Windows package command, and produces a zip archive beside the release directory. The submission README documents only this supported path and its expected output.

**Tech Stack:** PowerShell 7, Node.js 22 LTS, pnpm 11.5.0, Node.js ESM packaging script.

## Global Constraints

- The existing unrelated files directly under `E:\Downloads\lab1` must not be overwritten.
- The submission directory must exclude `node_modules`, `release`, `.git`, `.gcah`, and generated `dist` output.
- Source files, `pnpm-lock.yaml`, documentation, and `*.test.*` development tests must be retained.
- The generated release folder must be `release\gcah-windows-x64`, and its zip must be `release\gcah-windows-x64.zip`.
- No API key is included in the submission or build commands.

---

### Task 1: Create a clean, isolated submission source tree

**Files:**
- Create: `E:\Downloads\lab1\GCAH-submission\` (source tree copied from `E:\Desktop\GCAH`)

**Interfaces:**
- Consumes: current GCAH workspace source, lockfile, and documentation.
- Produces: an independent source tree with no installed dependencies or generated release artifacts.

- [ ] **Step 1: Verify the destination does not conflict with existing assignment files**

Run: `Get-ChildItem -LiteralPath 'E:\Downloads\lab1' -Force`

Expected: existing lab files remain outside the new `GCAH-submission` directory.

- [ ] **Step 2: Copy submission-relevant source directories and root manifests**

Copy `apps`, `packages`, `scripts`, `docs`, `examples`, `.github`, root configuration files, and `pnpm-lock.yaml` into `E:\Downloads\lab1\GCAH-submission`. Exclude `.git`, `.gcah`, `node_modules`, `release`, and every generated `dist` directory.

```powershell
robocopy E:\Desktop\GCAH E:\Downloads\lab1\GCAH-submission /E /XD .git .gcah node_modules release dist /XF *.log
```

- [ ] **Step 3: Verify source and development tests exist while generated artifacts do not**

Run: `Test-Path E:\Downloads\lab1\GCAH-submission\pnpm-lock.yaml; rg --files E:\Downloads\lab1\GCAH-submission\apps E:\Downloads\lab1\GCAH-submission\packages -g '*.test.*'; Test-Path E:\Downloads\lab1\GCAH-submission\node_modules`

Expected: lockfile and test files exist; `node_modules` is absent.

### Task 2: Add a repeatable release build entry point and documentation

**Files:**
- Create: `E:\Downloads\lab1\GCAH-submission\Build-Release.ps1`
- Create: `E:\Downloads\lab1\GCAH-submission\Build-Release.cmd`
- Create: `E:\Downloads\lab1\GCAH-submission\README-SUBMISSION.md`

**Interfaces:**
- Consumes: Node.js and pnpm available on `PATH`, plus the checked-in source and lockfile.
- Produces: `release\gcah-windows-x64` and `release\gcah-windows-x64.zip`.

- [ ] **Step 1: Implement the PowerShell build script**

The script must resolve its own root, reject Node below 22 and a missing pnpm command, run `pnpm install --frozen-lockfile`, execute `pnpm package:win -- --zip`, and stop on the first non-zero exit code.

```powershell
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm package:win -- --zip
exit $LASTEXITCODE
```

- [ ] **Step 2: Add a `.cmd` launcher for double-click usage**

```bat
@echo off
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build-Release.ps1"
pause
```

- [ ] **Step 3: Document prerequisites, one command, output files, and launch instructions**

README must state Node.js 22+, pnpm 11.5.0, no bundled API key, the `pwsh -ExecutionPolicy Bypass -File .\Build-Release.ps1` command, expected `release\gcah-windows-x64.zip`, and that the entire extracted folder—not only `gcah.exe`—must be moved.

### Task 3: Build and inspect the submission package from its new location

**Files:**
- Test: `E:\Downloads\lab1\GCAH-submission\Build-Release.ps1`

**Interfaces:**
- Consumes: the destination source package and README build command.
- Produces: a validated portable executable archive.

- [ ] **Step 1: Run the README build command from the destination tree**

Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File .\Build-Release.ps1`

Expected: exit code 0 and a release package built entirely from `E:\Downloads\lab1\GCAH-submission`.

- [ ] **Step 2: Verify the zip, executable, runtime, and no-link invariant**

Run: `Test-Path release\gcah-windows-x64.zip; Test-Path release\gcah-windows-x64\gcah.exe; Get-ChildItem -Recurse release\gcah-windows-x64\app\node_modules | Where-Object { $_.LinkType -ne $null }`

Expected: zip and executable exist; no Junction or SymbolicLink is returned.

- [ ] **Step 3: Verify the packaged executable launches**

Run: `& .\release\gcah-windows-x64\gcah.exe credential status`

Expected: exit code 0 with credential status output; no `ERR_MODULE_NOT_FOUND` occurs.

- [ ] **Step 4: Commit**

```powershell
git add Build-Release.ps1 Build-Release.cmd README-SUBMISSION.md
git commit -m "docs: add reproducible submission release build"
```
