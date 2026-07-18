# M3.2 Packaged Pet E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that built-in and imported pet packages work through the real packaged Windows application, Settings UI, IPC, Registry, and restart-persistence path.

**Architecture:** Electron Packager creates an unpacked Windows application with the original `pets/` directory copied as an external resource. Main-process path selection chooses the repository pet root during development and `process.resourcesPath/pets` when packaged. A command-line-gated M3.2 verifier drives the real sandboxed Settings renderer twice against one isolated user-data directory: first import/switch, then process restart and persisted-selection confirmation.

**Tech Stack:** TypeScript 6, Electron 43, React 19, Vitest 4, `@electron/packager` 20, Node.js child processes, Electron `webContents` automation.

## Global Constraints

- Do not add third-party character art or download pet assets.
- Reuse only the original Pixel Sprout package when creating the temporary E2E import fixture.
- Do not change Codex communication, App Server, Hook, quota, or `RuntimeController` behavior.
- Renderer code must remain sandboxed and must not receive filesystem paths.
- The E2E import-path override must require the explicit `--m3-2-e2e` process argument.
- Generated packages, user-data, screenshots, and reports remain under Git-ignored `release/` or `tmp/m3-2-e2e/`.
- Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build` before every commit.
- Never reset, rewrite published history, or force push.

---

### Task 1: Packaged resource layout

**Files:**

- Create: `src/main/pet-resource-path.ts`
- Create: `scripts/package-app.mjs`
- Create: `tests/pet-resource-path.test.ts`
- Modify: `src/main/index.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Produces: `resolveBuiltinPetsDirectory({ appPath, resourcesPath, isPackaged }): string`.
- Produces: `npm run package:dir`, with output `release/Codex Pet Desktop-win32-x64/` on Windows.

- [x] **Step 1: Write the resource-path test**

```ts
expect(
  resolveBuiltinPetsDirectory({
    appPath: "C:/repo",
    resourcesPath: "C:/bundle/resources",
    isPackaged: false,
  }),
).toBe(resolve("C:/repo/pets"));
expect(
  resolveBuiltinPetsDirectory({
    appPath: "C:/bundle/resources/app.asar",
    resourcesPath: "C:/bundle/resources",
    isPackaged: true,
  }),
).toBe(resolve("C:/bundle/resources/pets"));
```

- [x] **Step 2: Implement the path seam and package script**

```ts
export function resolveBuiltinPetsDirectory(input: PackagedPetPathInput): string {
  return resolve(input.isPackaged ? input.resourcesPath : input.appPath, "pets");
}
```

The packaging script builds a minimal staging application containing only `dist/` and a minimal
`package.json`, then calls `packager({ asar: true, extraResource: [petsDirectory] })` using the
repository's exact Electron version.

- [x] **Step 3: Run gates and commit**

Expected: four global gates exit 0 and `npm run package:dir` creates an EXE, `app.asar`, and
`resources/pets/example-original-pet/manifest.json`.

Commit: `feat: package built-in pet resources`

### Task 2: Packaged Settings UI restart E2E

**Files:**

- Create: `src/main/m3-2-settings-verifier.ts`
- Create: `scripts/run-m3-2-e2e.mjs`
- Create: `tests/m3-2-settings-verifier.test.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/settings/PetSelector.tsx`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**

- Produces: `runM32SettingsVerification(options): Promise<M32SettingsVerificationResult>`.
- Produces: `npm run verify:m3-2`, which runs the packaged EXE twice and writes an ignored combined report.

- [x] **Step 1: Add stable UI selectors and verifier-unit tests**

```tsx
<article data-testid="current-pet" data-pet-id={active.manifest.id}>
<button data-testid="pet-import">Import package</button>
<button data-testid={`pet-select-${pet.id}`}>Switch</button>
```

Test report validation for the import phase and restart phase without starting Electron.

- [x] **Step 2: Implement the command-line-gated verifier**

The import phase opens the real Settings BrowserWindow, clicks `pet-import`, waits for
`data-pet-id="e2e-sprout"`, confirms both previews loaded, clicks the built-in and imported switch
buttons, captures `settings-import.png`, and quits. The restart phase opens the packaged app with
the same isolated user-data directory, requires `e2e-sprout` to already be active, clicks Rescan,
captures `settings-restart.png`, and quits.

- [x] **Step 3: Implement the two-process runner**

The runner copies the original Pixel Sprout package into an ignored source directory, changes only
its ID/name metadata, launches the packaged EXE with phase-specific environment variables, checks
both JSON reports, and emits `combined.json`. It passes no pet path through renderer IPC.

- [x] **Step 4: Run gates, packaged E2E, and commit**

Expected: four global gates exit 0; `npm run verify:m3-2` reports import, switching, image loading,
restart persistence, rescan, screenshots, packaged resource discovery, and graceful quit as passed.

Commit: `test: add packaged pet settings e2e`

### Task 3: M3.2 documentation and publication

**Files:**

- Create: `docs/reports/M3_2_IMPLEMENTATION.md`
- Modify: `README.md`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Modify: `docs/guides/PET_PACKAGE_SYSTEM.md`
- Modify: `docs/plans/PROJECT_PLAN.md`
- Modify: this plan

**Interfaces:**

- Documents exact package output, resource layout, E2E command, evidence classification, and limits.

- [x] **Step 1: Record measured evidence**

Record the final test count, package output checks, two-phase report fields, screenshots, commit
history, and the distinction between automated packaged UI proof and a human native-picker test.

- [x] **Step 2: Run final gates and commit**

Commit: `docs: document M3.2 packaged pet verification`

- [x] **Step 3: Push and verify**

Run `git push origin feat/m3-0-settings-center`, compare local HEAD with `git ls-remote`, and require
a clean worktree.

## Self-Review

- Spec coverage: the plan covers production pet resources, packaged executable launch, Settings UI import/switch, preview loading, restart persistence, rescan, screenshots, and truthful evidence reporting.
- Placeholder scan: every change has exact files, interfaces, commands, and expected results.
- Type consistency: the resource-path resolver feeds `PetRegistry`; UI test IDs feed the verifier; phase reports feed the two-process runner and implementation report.
