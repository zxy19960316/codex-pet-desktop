# Pokémon Local 12-State Pets Implementation Plan

> **For agentic workers:** Execute this plan inline in the current task. The user explicitly requested direct execution without a confirmation pause; no subagent or public publishing workflow is authorized.

**Goal:** Build, validate, and locally install Pikachu, Charizard, and Mew pet packages with complete 12-state animation mappings while keeping every third-party or derived image outside Git and release artifacts.

**Architecture:** Keep upstream and generated binaries under `tmp/local-pokepets/`, which is Git-ignored. Reuse the existing generic `PetManifest`/`PetRegistry` path because it already supports independent PNG/WebP sprite files per animation; do not change the fixed-atlas Codex PokéPets adapter. Add reusable local-only workflow scripts that download three allow-listed packages, build deterministic strips from generated key poses, validate packages, and atomically install them into the Electron managed user-data pet directory.

**Tech Stack:** Node.js ESM, TypeScript/Vitest, Python 3 with Pillow for local image composition, Electron pet registry, built-in image generation.

## Global Constraints

- Only `pikachu`, `charizard`, and `mew` may be downloaded by the workflow.
- Source and derived binaries remain under `tmp/local-pokepets/` until copied into the managed user-data pet directory.
- Every frame is `192×208`; each state strip is one row, PNG or WebP, with `frameRow: 0`.
- The 12 required states are `idle`, `thinking`, `typing`, `working`, `approval`, `waiting_input`, `success`, `error`, `quota_low`, `quota_empty`, `offline`, and `sleep`.
- `thinking`, `typing`, `working`, `approval`, `success`, `error`, and `sleep` receive independently generated key poses.
- No Pokémon image, generated derivative, Base64 payload, archive, cache, or local manifest may enter Git, the installer, a push, a PR, or a release.
- Existing Pixel Sprout behavior and legacy single-atlas manifests must remain unchanged.
- Do not commit or push as part of this task.

---

### Task 1: Lock down local artifact isolation

**Files:**

- Modify: `.gitignore`
- Test: Git ignore checks against source, derived, preview, and managed-staging paths

**Interfaces:**

- Consumes: repository-local `tmp/` conventions
- Produces: precise ignore coverage for every local Pokémon artifact path

- [ ] Add the exact rules `tmp/local-pokepets/`, `tmp/third_party/`, `tmp/local-derived-pets/`, `**/spritesheet-local*.webp`, and `**/*-local-12state/`.
- [ ] Create probe files only under `tmp/local-pokepets/` and confirm `git check-ignore -v` identifies the new rule.
- [ ] Confirm `git status --short` contains no local image or manifest.

### Task 2: Add the allow-listed fetch and source validation workflow

**Files:**

- Create: `scripts/local-pokepets/local-pokepets-lib.mjs`
- Create: `scripts/local-pokepets/fetch-pets.mjs`
- Create: `scripts/local-pokepets/validate-source.mjs`
- Test: `tests/local-pokepets-workflow.test.ts`

**Interfaces:**

- Consumes: GitHub raw files `pets/<id>/pet.json`, `spritesheet.webp`, and `preview.gif`
- Produces: `tmp/local-pokepets/source/<id>/` plus machine-readable validation JSON

- [ ] Write failing tests for pet allow-list rejection, safe ignored-root resolution, WebP signature/dimensions, and source ID matching.
- [ ] Run `npx vitest run tests/local-pokepets-workflow.test.ts` and confirm the new module imports fail.
- [ ] Implement shared constants, safe-root checks, atomic downloads, and WebP/GIF metadata readers without embedding assets.
- [ ] Implement `fetch-pets.mjs` so repeated runs preserve already valid files and temporary downloads are removed on failure.
- [ ] Implement `validate-source.mjs` so all three sources must be `1536×1872`, use a `192×208` `8×9` grid, and contain readable previews.
- [ ] Run the focused test and then fetch and validate all three packages.

### Task 3: Add local frame composition, manifest creation, QA, and installation

**Files:**

- Create: `scripts/local-pokepets/image-tools.py`
- Create: `scripts/local-pokepets/build-animation-strip.mjs`
- Create: `scripts/local-pokepets/validate-derived-pet.mjs`
- Create: `scripts/local-pokepets/install-derived-pet.mjs`
- Test: `tests/local-pokepets-workflow.test.ts`

**Interfaces:**

- Consumes: source atlas frames or transparent generated key-pose PNGs
- Produces: single-row WebP strips, `manifest.json`, contact sheets, animated previews, validation report, and installed managed pet directories

- [ ] Write failing tests for path containment, required 12-state manifests, frame-count geometry, invalid symlinks, and installation pre-validation.
- [ ] Implement Pillow commands for reference extraction, alpha-aware centering, fixed-canvas strip generation, WebP export, contact sheets, and animated WebP previews.
- [ ] Implement `build-animation-strip.mjs` with state-specific frame counts/FPS and motion curves; update manifest entries only after an atomic successful build.
- [ ] Implement `validate-derived-pet.mjs` to enforce safe paths, regular files, WebP signatures, `192×208` frame geometry, exact `frames × 192` width, reasonable FPS, unique ID, and all 12 states.
- [ ] Implement `install-derived-pet.mjs` to validate first, copy through a temporary managed-directory sibling, rename atomically, and never overwrite a valid installed package unless `--replace` is explicit.
- [ ] Run the focused test and verify generated synthetic fixtures.

### Task 4: Generate the three local 12-state packages

**Files:**

- Local only: `tmp/local-pokepets/references/<id>/`
- Local only: `tmp/local-pokepets/generated/<id>/`
- Local only: `tmp/local-pokepets/derived/<id>-local-12state/`

**Interfaces:**

- Consumes: original atlas/preview references and one built-in image-generation call per character per key state
- Produces: three complete derived packages with provenance/classification metadata

- [ ] Extract and visually inspect one clean source reference per character.
- [ ] Generate one character/state key pose for each of the seven priority states, on a flat chroma-key background, preserving species, palette, pixel-art proportions, viewpoint, baseline, and hard pixel edges.
- [ ] Remove chroma key locally, inspect alpha coverage, and reject malformed outputs before strip construction.
- [ ] Build `idle` from the preserved source atlas; build the seven priority state strips from independent key poses; derive `waiting_input`, `quota_low`, `quota_empty`, and `offline` with documented weaker/low-energy motion variants.
- [ ] Write manifests with local-only/redistribution flags, source attribution, actual per-state files, frame counts, FPS, and generation classification.
- [ ] Generate each character's 12-state contact sheet and animated preview under the ignored QA directory.

### Task 5: Validate, install, and exercise application integration

**Files:**

- Local only: `%APPDATA%/Codex Pet Desktop/pets/<id>-local-12state/`
- Local only: `tmp/local-pokepets/reports/final-validation.json`

**Interfaces:**

- Consumes: three validated derived packages
- Produces: installed registry packages, persisted selection evidence, renderer/state/scale evidence, and final Git safety evidence

- [ ] Validate all three packages and save a combined machine-readable report.
- [ ] Install all three atomically into the active managed pet directory and confirm registry scan lists their display names without issues.
- [ ] Exercise all 12 states for each package through the existing resolver and sprite-style code; verify requested state equals resolved state and no animation falls back.
- [ ] Exercise 50%, 100%, 150%, and 200% metrics and confirm positive unclipped stage/window dimensions.
- [ ] Switch among all three, instantiate a fresh registry, and verify persisted restoration; restore the user's preferred active pet at the end.
- [ ] Verify Pixel Sprout still loads and resolves its existing animations.
- [ ] Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`.
- [ ] Inspect contact sheets/animated previews and report visual QA separately from automated checks; do not claim unperformed human UI checks.
- [ ] Run final `git diff`, `git status --short`, and `git check-ignore -v` checks and confirm no third-party or derived file is tracked or staged.
