# M3.1 2D Pet Asset System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed renderer-only test character with a validated, importable, switchable PNG pet-package system without changing Codex transport behavior.

**Architecture:** Main-process `PetRegistry` owns filesystem scanning, validation, imports, active selection, and safe asset URLs. Shared IPC snapshots carry normalized pet data to sandboxed renderers; `AnimationResolver` converts normalized pet states into concrete PNG sprite assets. UI themes remain renderer styles and pet packages live under `pets/` or the Git-ignored user-data pet directory.

**Tech Stack:** TypeScript 6, Electron 43, React 19, Vitest 4, Node.js filesystem APIs, PNG sprite sheets.

**Status:** Completed on `feat/m3-0-settings-center`; implementation and verification followed the
six commit boundaries below.

## Global Constraints

- Do not add Pokemon or other third-party copyrighted character assets.
- Do not modify Codex communication, App Server, Hook, or quota behavior.
- Keep the Settings Center architecture and renderer sandbox boundary intact.
- Do not add skeletal animation in M3.1; support PNG sprite sheets only.
- Reject unsafe paths, symbolic links, malformed manifests, and invalid PNG resources without crashing.
- Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build` before every commit.
- Never reset, force push, or rewrite published history.

---

### Task 1: Pet manifest schema and original example package

**Files:**

- Create: `src/core/pet/pet-manifest.ts`
- Create: `pets/example-original-pet/manifest.json`
- Create: `pets/example-original-pet/preview.png`
- Create: `pets/example-original-pet/sprites/*.png`
- Create: `pets/example-original-pet/LICENSE`
- Modify: `src/shared/pet-manifest.ts`

**Interfaces:**

- Produces: `PetManifest`, `PetAnimationDefinition`, `PetPackage`, `PetSummary`, `validatePetManifest(value)`.
- Consumes: canonical `PetState` names from `src/core/pet/pet-state.ts`.

- [ ] **Step 1: Define the complete schema and validation result**

```ts
export interface PetAnimationDefinition {
  name: string;
  sprite: string;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop: boolean;
}

export interface PetManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  license: string;
  preview: string;
  assets: { sprites: string[]; sounds?: string[] };
  animations: Partial<Record<PetState, PetAnimationDefinition>>;
  capabilities: { spriteSheet: true; sounds?: boolean };
  metadata: Record<string, string | number | boolean | null>;
  fallbacks?: Partial<Record<PetState, PetState>>;
}
```

- [ ] **Step 2: Add an original PNG package**

Create a package whose manifest declares `idle`, `thinking`, `working`, and `success`; all remaining states resolve through explicit or default fallbacks. The committed art is derived only from the repository's original Pixel Sprout artwork.

- [ ] **Step 3: Run the full gate and commit**

Run: `npm run format:check`, `npm run lint`, `npm test`, `npm run build`

Expected: all commands exit 0.

Commit: `feat: add pet manifest schema`

### Task 2: Registry, validation, import, and active selection

**Files:**

- Create: `src/core/pet/pet-registry.ts`
- Create: `src/core/pet/external-pet-adapter.ts`

**Interfaces:**

- Consumes: `validatePetManifest(value)` and pet package types.
- Produces: `scan()`, `getAvailablePets()`, `getPet(id)`, `getActivePet()`, `setActivePet(id)`, `validatePet(folder)`, `importPetPackage(folder)`.

- [ ] **Step 1: Implement safe directory scanning**

```ts
const registry = new PetRegistry({
  builtinDirectory,
  userDirectory,
  activePetId: "pixel-sprout",
});
await registry.scan();
const pets = registry.getAvailablePets();
```

Scan both roots, isolate each package error, cache valid packages, expose issue details, and fall back to the built-in pet if the persisted ID is absent.

- [ ] **Step 2: Validate concrete assets**

Require `manifest.json`, preview PNG, all declared sprite PNGs, valid PNG signatures and dimensions, safe relative paths, and no symlinks. Infer sprite frame counts from PNG width and declared frame width.

- [ ] **Step 3: Implement safe import and persistence**

Validate the source first, copy into a temporary directory under `user-data/pets`, validate the copy, atomically rename it, refresh the cache, and return a specific error without leaving partial data.

- [ ] **Step 4: Add the format-neutral adapter contract**

```ts
export interface ExternalPetAdapter<TSource = unknown> {
  readonly id: string;
  canAdapt(source: TSource): boolean | Promise<boolean>;
  adapt(source: TSource, destination: string): Promise<PetManifest>;
}
```

- [ ] **Step 5: Run the full gate and commit**

Run the four global gate commands; all must exit 0.

Commit: `feat: add pet registry`

### Task 3: Canonical states and animation resolver

**Files:**

- Modify: `src/core/pet/pet-state.ts`
- Modify: `src/core/pet/state-priority.ts`
- Modify: `src/core/pet/state-machine.ts`
- Create: `src/core/pet/animation-resolver.ts`
- Modify: `src/renderer/pet/pet-animation.ts`

**Interfaces:**

- Consumes: `PetPackage.animations` and canonical `PetState`.
- Produces: `AnimationResolver.resolve(pet, state)` returning `{ requestedState, resolvedState, animation }`.

- [ ] **Step 1: Use the M3.1 state vocabulary**

```ts
export const PET_STATES = [
  "sleep",
  "idle",
  "thinking",
  "typing",
  "working",
  "approval",
  "waiting_input",
  "success",
  "error",
  "quota_low",
  "quota_empty",
  "offline",
] as const;
```

- [ ] **Step 2: Implement deterministic fallback chains**

`working -> thinking -> idle`, `typing -> working -> thinking -> idle`, request states to `thinking -> idle`, and terminal/unavailable states to `idle` or `sleep -> idle`. Manifest fallbacks take precedence; cycles still end at idle.

- [ ] **Step 3: Convert resolved animation metadata to CSS variables**

Use `frames / fps * 1000`, inferred frame count, concrete sprite URL, sheet width, and sheet height. Do not perform filesystem access in the renderer.

- [ ] **Step 4: Run the full gate and commit**

Run the four global gate commands; all must exit 0.

Commit: `feat: add animation resolver`

### Task 4: Main-process wiring and Settings pet manager

**Files:**

- Modify: `src/main/index.ts`
- Modify: `src/shared/ipc-contract.ts`
- Modify: `src/shared/ipc/settings-ipc.ts`
- Modify: `src/main/settings/settings-ipc-handlers.ts`
- Modify: `src/preload/settings.ts`
- Modify: `src/renderer/app/App.tsx`
- Modify: `src/renderer/pet/Pet.tsx`
- Delete: `src/renderer/pet/builtin-theme.ts`
- Create: `src/renderer/settings/PetSelector.tsx`
- Modify: `src/renderer/settings/SettingsApp.tsx`
- Modify: `src/renderer/settings/settings.css`
- Delete: `themes/example-original-pet/*`

**Interfaces:**

- Consumes: `PetRegistry` snapshots and `AnimationResolver`.
- Produces: narrow Settings API methods `setActivePet`, `importPetPackage`, `rescanPets`, and `openPetsDirectory`.

- [ ] **Step 1: Initialize the registry before windows and runtime**

Use `app.getAppPath()/pets` for bundled packages and `app.getPath("userData")/pets` for imports. Decorate outgoing desktop and Settings snapshots with the active package and summaries without refactoring `RuntimeController`.

- [ ] **Step 2: Add guarded pet IPC handlers**

Only accept a validated pet ID string from the Settings renderer. Folder import uses an Electron main-process directory picker; opening the user directory uses `shell.openPath`.

- [ ] **Step 3: Render the active package**

Pass `snapshot.pet.active` into `Pet`; resolve every state through `AnimationResolver`; retain a non-crashing empty visual if no package can be loaded.

- [ ] **Step 4: Build the PetSelector**

Show current preview, name, version, author, license, active/available cards, and buttons for switch, import, directory, and rescan. Surface specific operation errors and do not change existing settings controls.

- [ ] **Step 5: Run the full gate and commit**

Run the four global gate commands; all must exit 0.

Commit: `feat: integrate pet manager UI`

### Task 5: Pet system tests

**Files:**

- Create: `tests/pet-manifest.test.ts`
- Create: `tests/pet-registry.test.ts`
- Create: `tests/animation-resolver.test.ts`
- Modify: `tests/pet-animation.test.ts`
- Modify: `tests/pet-state.test.ts`
- Modify: `tests/settings-ipc-validation.test.ts`
- Modify: `tests/settings-renderer-boundary.test.ts`

**Interfaces:**

- Verifies all public M3.1 interfaces and renderer sandbox boundaries.

- [ ] **Step 1: Cover manifest and registry behavior**

Test valid manifests, malformed manifests, missing sprites, corrupted PNGs, fallback selection, multiple pet switching, successful import, rejected import, duplicate import, and scan isolation.

- [ ] **Step 2: Cover resolver behavior**

Test direct `working`, absent `working`, the `working -> thinking -> idle` chain, manifest overrides, and fallback cycles.

- [ ] **Step 3: Cover Settings IPC authorization**

Test valid IDs, invalid IDs, unauthorized senders, and narrow preload exposure.

- [ ] **Step 4: Run the full gate and commit**

Run the four global gate commands; all must exit 0.

Commit: `test: add pet system tests`

### Task 6: Package documentation and final verification

**Files:**

- Create: `docs/guides/PET_PACKAGE_SYSTEM.md`
- Modify: `README.md`
- Modify: `ASSET_POLICY.md`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Modify: `docs/plans/PROJECT_PLAN.md`
- Modify: this plan

**Interfaces:**

- Documents package authoring, import behavior, fallbacks, trust boundary, external adapters, and copyright policy.

- [ ] **Step 1: Document the manifest and directory layout**

Include a complete JSON example using PNG sprite sheets and explain every field, path restriction, inferred frames, and fallback.

- [ ] **Step 2: Document operational behavior**

Explain built-in versus user-data directories, switching, rescanning, duplicate handling, failure isolation, and the fact that external adapters are a neutral future extension point.

- [ ] **Step 3: Run the full gate and commit**

Run the four global gate commands; all must exit 0.

Commit: `docs: document pet package system`

- [ ] **Step 4: Verify history and publish**

Run: `git status`, `git log --oneline -10`, `git diff origin/feat/m3-0-settings-center...HEAD --stat`, and `git push origin feat/m3-0-settings-center`.

Expected: clean worktree, six focused M3.1 commits, and a successful non-force push.

## Self-Review

- Spec coverage: package schema, registry, PNG animation resolver, Settings UI, folder import, external adapter contract, tests, docs, and copyright restrictions are assigned to explicit tasks.
- Placeholder scan: the plan contains no TBD, TODO, or unspecified implementation step.
- Type consistency: `PetManifest` feeds `PetRegistry`; `PetPackage` feeds `AnimationResolver`; normalized registry snapshots feed both renderers through dedicated IPC types.
