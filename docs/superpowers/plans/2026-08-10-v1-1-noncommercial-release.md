# Codex Pet Desktop v1.1.0 Noncommercial Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the current desktop experience as a verified Windows v1.1.0 release whose source and bundled original assets are available for noncommercial use only.

**Architecture:** Preserve the existing Electron main/preload/renderer boundaries and treat the dirty `feat/m4-1-session-intelligence` worktree as the release candidate. Keep locally imported or derived third-party character assets outside Git and the installer; package only the tracked original Pixel Sprout pet and tracked branding. Preserve the immutable MIT-licensed v1.0.0 release, apply PolyForm Noncommercial 1.0.0 to v1.1.0, then fast-forward the tested history to `main`, tag the exact commit, and attach the verified installer and checksum to GitHub Releases.

**Tech Stack:** Electron 43, React 19, TypeScript 6, Vite 8, Vitest 4, electron-builder/NSIS, PowerShell, GitHub CLI

## Global Constraints

- Do not rewrite or move the published `v1.0.0` tag.
- The new public version is `1.1.0` in `package.json`, `package-lock.json`, the installer, changelog, documentation, Git tag, and GitHub Release.
- Source and bundled original assets in v1.1.0 use PolyForm Noncommercial License 1.0.0; previous releases retain their original licenses.
- Noncommercial terms make v1.1.0 source-available, not OSI-approved open source; public wording must say so explicitly.
- Never commit or package local Pokémon, Codex PokéPets, other third-party character assets, user session data, credentials, logs, or generated release directories.
- Package only the tracked `pets/example-original-pet` Pixel Sprout package and tracked application branding.
- Do not create a pull request solely from the push request; publish the tested branch and release lineage directly without force-push or history rewriting.

---

### Task 1: Freeze and Review the Existing Release Candidate

**Files:**

- Review: `src/core/codex/session-lifecycle.ts`
- Review: `src/main/codex-session-monitor.ts`
- Review: `src/main/runtime-controller.ts`
- Review: `src/renderer/sessions/SessionQuickView.tsx`
- Review: `src/renderer/sessions/session-view-model.ts`
- Review: `src/renderer/settings/settings-copy.ts`
- Review: `scripts/local-pokepets/build-animation-strip.mjs`
- Review: `scripts/local-pokepets/create-validation-report.mjs`
- Review: `scripts/local-pokepets/image-tools.py`
- Review: `tests/session-lifecycle.test.ts`
- Review: `tests/session-hub.test.ts`
- Review: `tests/session-ui-view-model.test.ts`
- Review: `tests/settings-localization.test.ts`
- Review: `tests/local-pokepets-workflow.test.ts`

**Interfaces:**

- Consumes: the current dirty worktree rooted at commit `1a0e30bfffc2c6d4b440c5ca347aa8bca66534da`
- Produces: an explicit intended-file inventory with no secrets, session data, generated binaries, or redistributability violations

- [ ] **Step 1: Confirm repository and remote identity**

  Run `git rev-parse --show-toplevel`, `git status -sb`, `git remote -v`, `git branch -vv`, and `git tag --sort=-version:refname`.

  Expected: repository `codex-pet-desktop`, branch `feat/m4-1-session-intelligence`, remote `zxy19960316/codex-pet-desktop`, and immutable tag `v1.0.0` at `8e6b4d4...`.

- [ ] **Step 2: Review every tracked and untracked candidate file**

  Run `git diff --name-status`, `git diff --check`, and `git ls-files --others --exclude-standard`, then inspect the complete diffs and new files by responsibility.

  Expected: only session intelligence, Chinese settings/HUD, pet motion/tooling, tests, implementation plans, and release documentation are included.

- [ ] **Step 3: Audit ignored local material without adding it**

  Inspect `user-pets/`, `assets-local/`, `pokemon-pets/`, `tmp/local-pokepets/`, `tmp/local-derived-pets/`, `tmp/imagegen/`, `release/`, and local Codex data paths only for file identity and provenance.

  Expected: third-party/derived character art and user data remain ignored and excluded; only tracked original assets qualify for the installer.

### Task 2: Complete and Validate the Latest Desktop Features

**Files:**

- Modify: existing changed files under `src/core/codex/`, `src/main/`, `src/preload/`, `src/renderer/`, and `src/shared/` only if a release-blocking defect is found
- Modify: existing changed files under `scripts/local-pokepets/` only if their tests expose a defect
- Test: all existing changed and new files under `tests/`

**Interfaces:**

- Consumes: normalized `DesktopSnapshot.sessionOverview`, the bounded session lifecycle parser, settings IPC, and tracked pet-package contracts
- Produces: a compiling UI that exposes session summaries without leaking raw session IDs/content and local animation tooling that never redistributes its inputs

- [ ] **Step 1: Run the focused new tests**

  Run `npx vitest run tests/session-lifecycle.test.ts tests/session-hub.test.ts tests/session-ui-view-model.test.ts tests/settings-localization.test.ts tests/local-pokepets-workflow.test.ts`.

  Expected: all focused tests pass and privacy assertions confirm prompt, path, session ID, and turn ID content is not rendered or serialized where prohibited.

- [ ] **Step 2: Correct only observed release blockers**

  Keep fixes within the file group that owns the failing contract. Preserve the main/preload/renderer boundary, fixed diagnostics, local-only asset conversion, and normalized session view model.

- [ ] **Step 3: Re-run focused tests**

  Run the same focused Vitest command.

  Expected: exit code 0 with no skipped failure represented as a pass.

- [ ] **Step 4: Commit the completed feature candidate**

  Stage only the reviewed feature, tooling, test, and matching implementation-plan files. Commit with `feat: complete v1.1 desktop experience`.

### Task 3: Apply Version 1.1.0 and Noncommercial Terms

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Replace: `LICENSE`
- Modify: `pets/example-original-pet/LICENSE`
- Modify: `pets/example-original-pet/manifest.json`
- Modify: `pets/example-original-pet/README.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `ASSET_POLICY.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Modify: `docs/guides/CODEX_POKEPETS_IMPORT.md`
- Modify: `docs/guides/PET_PACKAGE_SYSTEM.md`
- Modify: `docs/superpowers/plans/2026-08-10-v1-1-noncommercial-release.md`

**Interfaces:**

- Consumes: official PolyForm Noncommercial License 1.0.0 text and the repository's SemVer release policy
- Produces: consistent `1.1.0` metadata and clear English/Chinese noncommercial source-available terms

- [ ] **Step 1: Update package metadata mechanically**

  Run `npm version 1.1.0 --no-git-tag-version` and set `package.json` license to `PolyForm-Noncommercial-1.0.0` and description to a noncommercial source-available description.

  Expected: `package.json` and `package-lock.json` both contain version `1.1.0` and the same license identifier.

- [ ] **Step 2: Replace the MIT grant for v1.1.0**

  Copy the official unmodified PolyForm Noncommercial 1.0.0 terms into `LICENSE` and the bundled pet license, including `Required Notice: Copyright 2026 Codex Pet Desktop contributors.`.

  Expected: the terms allow personal, educational, charitable, public-research, and other noncommercial purposes while granting no general commercial-use permission.

- [ ] **Step 3: Align bundled pet metadata**

  Set Pixel Sprout's manifest and README license to `PolyForm-Noncommercial-1.0.0`; retain its original/procedural provenance.

- [ ] **Step 4: Rewrite public usage and download documentation**

  Document Windows requirements, v1.1.0 asset names, PowerShell SHA-256 verification, startup/menu/settings/session-Hub usage, local pet import, source build commands, unsigned SmartScreen warning, and exact noncommercial restrictions in both READMEs.

  State that v1.1.0 is source-available rather than OSI-approved open source, commercial use requires separate written permission, dependencies keep their own licenses, and v1.0.0 remains under its originally published MIT terms.

- [ ] **Step 5: Add the dated v1.1.0 changelog entry and contributor terms**

  Record session Hub, Chinese UI, lifecycle parsing, motion/tooling improvements, privacy boundaries, original-asset packaging, and the license change under `2026-08-10`.

- [ ] **Step 6: Remove stale current-license claims**

  Search tracked non-historical product documentation for `MIT`, `open-source`, `commercial`, `license`, `许可`, and `商用`. Keep historical plan/release statements intact only when clearly time-scoped.

- [ ] **Step 7: Commit version, license, and release documentation**

  Stage only the files listed in this task and commit with `docs: prepare v1.1.0 noncommercial release`.

### Task 4: Run the Full Quality and Packaging Gates

**Files:**

- Verify: entire tracked repository
- Generate locally only: `dist/`, `build/generated/`, `release/`, and `tmp/m3-3-e2e/`

**Interfaces:**

- Consumes: the exact two release-candidate commits from Tasks 2 and 3
- Produces: reproducible test/build/installer evidence and a locally verified unsigned Windows installer

- [ ] **Step 1: Run repository quality gates in order**

  Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`.

  Expected: each command exits 0; record exact test file, pass, skip, and warning counts.

- [ ] **Step 2: Build the Windows installer and checksum**

  Run `npm run package:installer`.

  Expected: `release/m3-3/codex-pet-desktop-1.1.0-setup-x64.exe` and `release/m3-3/codex-pet-desktop-1.1.0-setup-x64.exe.sha256` exist and identify version 1.1.0.

- [ ] **Step 3: Run packaged installer lifecycle verification**

  Run `npm run test:e2e:m3-3` after the installer build.

  Expected: install, packaged Settings/Pets flows, uninstall, installation-directory cleanup, and temporary-data cleanup all pass. Report signing as `NotSigned` unless a real signing certificate is configured.

- [ ] **Step 4: Verify bytes and packaged assets**

  Run `Get-FileHash` on the installer, compare it byte-for-byte with the `.sha256` file, inspect the packaged app resources, and confirm only tracked Pixel Sprout assets are present.

### Task 5: Publish the Exact Verified Release

**Files:**

- Publish: reviewed Git commits
- Publish binary: `release/m3-3/codex-pet-desktop-1.1.0-setup-x64.exe`
- Publish checksum: `release/m3-3/codex-pet-desktop-1.1.0-setup-x64.exe.sha256`

**Interfaces:**

- Consumes: clean worktree, passing gates, exact installer/checksum pair, authenticated GitHub CLI
- Produces: remote feature branch, stable `main`, annotated `v1.1.0` tag, and public GitHub Release downloads all pointing to the same commit/version

- [ ] **Step 1: Audit the final commit and worktree**

  Run `git diff HEAD^`, `git status --short`, `git ls-files` checks for generated binaries/local material, and a bounded secret/path scan.

  Expected: clean tracked worktree, ignored release output only, no local or third-party asset packages, no credentials/session files/logs, and no unexpected binaries.

- [ ] **Step 2: Push the feature branch without rewriting history**

  Run `git push -u origin feat/m4-1-session-intelligence`.

  Expected: remote branch head equals local tested head.

- [ ] **Step 3: Fast-forward stable main**

  Update local `main` from `origin/main`, verify it is an ancestor of the release commit, fast-forward it to the exact tested commit, and run `git push origin main`.

  Expected: `origin/main` equals the tested release commit; no merge commit, rebase, amend, or force-push occurs.

- [ ] **Step 4: Tag the exact release commit**

  Create annotated tag `v1.1.0` with message `Codex Pet Desktop v1.1.0` at the verified commit and run `git push origin v1.1.0`.

- [ ] **Step 5: Create the public GitHub Release**

  Run `gh release create v1.1.0` with title `Codex Pet Desktop v1.1.0`, changelog-derived release notes, the installer, and its `.sha256` file.

  Expected: the release is public, non-draft, non-prerelease, and lists both assets.

- [ ] **Step 6: Verify remote identity and downloads**

  Query the remote branch/tag and `gh release view v1.1.0 --json ...`; compare tag SHA, main SHA, release target, asset names, asset sizes, and GitHub's installer digest with local evidence.

  Expected: every identity matches and the README `releases/latest` link resolves to v1.1.0.

## Self-Review

- Spec coverage: includes latest changes, distributable local/original assets, usage/download docs, explicit noncommercial restriction, push, tag, and GitHub release.
- Placeholder scan: no `TBD`, `TODO`, “implement later”, or unspecified test/fix steps remain.
- Type consistency: release documentation consumes existing `DesktopSnapshot.sessionOverview`; no new runtime interface is introduced by the release-only work.
- Safety: published v1.0.0 history is preserved; copyrighted local character assets and private Codex data remain excluded.
