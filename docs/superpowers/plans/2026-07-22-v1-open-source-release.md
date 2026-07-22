# Codex Pet Desktop v1.0 Open Source Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the complete desktop-pet experience as a visitor-ready `v1.0.0` GitHub release with clear installation, usage, versioning, contribution, and local asset-integration documentation.

**Architecture:** Keep the existing Electron application and local-only pet package boundary intact. Treat `package.json` as the version source, generate the existing NSIS x64 installer, document the stable public workflows, then fast-forward the validated feature history to `main`, tag it, and attach the installer plus checksum to a GitHub Release.

**Tech Stack:** Electron 43, React 19, TypeScript 6, Vite 8, Vitest 4, electron-builder/NSIS, Git, GitHub CLI.

## Global Constraints

- Release version is exactly `1.0.0`; Git tag and GitHub Release name are exactly `v1.0.0`.
- The repository remains MIT licensed and public.
- No Pokemon or other copyrighted character artwork may be committed or attached to the release.
- User pet packs, Codex session data, credentials, logs, and generated local assets remain ignored and local-only.
- The Windows installer is unsigned; documentation must state that Windows may show a SmartScreen warning.
- Published history must not be rewritten and no force push is allowed.

---

### Task 1: Release Metadata and Visitor Documentation

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Create: `CHANGELOG.md`
- Create: `VERSIONING.md`
- Create: `docs/guides/PET_ASSET_AUTHORING.md`

**Interfaces:**

- Consumes: Existing NSIS packaging commands, Settings Center pet import UI, and the canonical twelve-state pet manifest contract.
- Produces: A single `1.0.0` version identity plus visitor-facing installation, operation, development, versioning, and asset-authoring guidance.

- [ ] **Step 1: Set package metadata to version 1.0.0**

Run: `npm version 1.0.0 --no-git-tag-version`

Expected: `package.json` and `package-lock.json` both report `1.0.0` without creating a commit or tag.

- [ ] **Step 2: Rewrite the README as the public landing page**

Include release download links, Windows requirements, install/run instructions, tray and Settings usage, Codex auto-detection behavior, HUD field meanings, privacy, unsigned-installer warning, development commands, documentation links, and independence notices.

- [ ] **Step 3: Add release and version policy documents**

Create `CHANGELOG.md` with the v1.0.0 feature set and `VERSIONING.md` with SemVer, branch, commit, tag, release, and hotfix rules.

- [ ] **Step 4: Add public pet asset authoring instructions**

Document folder layout, accepted PNG/WebP formats, all twelve runtime states, fallback behavior, size limits, manifest validation, Settings import, local 12-state conversion scripts, and copyright rules without distributing third-party character art.

- [ ] **Step 5: Strengthen contribution guidance**

Document issue/branch/commit/PR expectations, mandatory quality gates, privacy checks, and prohibited asset/data submissions.

### Task 2: Release Audit and Build Verification

**Files:**

- Verify: `.gitignore`
- Verify: `ASSET_POLICY.md`
- Verify: `electron-builder.json`
- Verify: `release/m3-3/codex-pet-desktop-1.0.0-setup-x64.exe`
- Verify: `release/m3-3/codex-pet-desktop-1.0.0-setup-x64.exe.sha256`

**Interfaces:**

- Consumes: Task 1 metadata and the complete v1 implementation tree.
- Produces: Tested source plus a reproducible unsigned Windows x64 installer and matching SHA-256 file.

- [ ] **Step 1: Format documentation and source**

Run: `npm run format`

Expected: Prettier completes successfully and only intended release/source files remain changed.

- [ ] **Step 2: Run repository quality gates**

Run: `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`.

Expected: Every command exits with code 0 and all non-skipped automated tests pass.

- [ ] **Step 3: Build the v1.0.0 installer**

Run: `npm run package:installer`

Expected: The 1.0.0 NSIS x64 installer and `.sha256` file exist under `release/m3-3/`.

- [ ] **Step 4: Audit tracked and staged content**

Run: `git diff --check`, inspect `git diff`, list untracked files, search for credential-like filenames, and confirm `git ls-files` contains no local Pokemon sprites, logs, session records, or release output.

Expected: No whitespace errors, secrets, private data, generated binaries, or non-redistributable pet assets are selected for commit.

### Task 3: Publish Source and GitHub Release

**Files:**

- Publish: current feature branch
- Publish: `main`
- Tag: `v1.0.0`
- Release assets: installer and SHA-256 checksum

**Interfaces:**

- Consumes: Task 2 verified tree and artifacts.
- Produces: Public GitHub source at `main`, immutable version tag, and downloadable v1.0.0 release assets.

- [ ] **Step 1: Commit the complete v1 scope**

Stage only repository source, tests, original branding, plans, and public documentation. Commit with Conventional Commit title `feat: release Codex Pet Desktop v1.0.0`.

- [ ] **Step 2: Push the feature branch**

Run: `git push -u origin feat/m3-4-pokepets-experience`

Expected: Remote feature branch points to the v1.0.0 commit.

- [ ] **Step 3: Fast-forward main and push**

Fetch the remote, verify `origin/main` is an ancestor of the release commit, fast-forward local `main`, then push `main` without force.

Expected: Local and remote `main` point to the verified v1.0.0 commit.

- [ ] **Step 4: Create and push the v1.0.0 tag**

Create annotated tag `v1.0.0` at the release commit and push that tag.

Expected: GitHub exposes the exact source snapshot under `v1.0.0`.

- [ ] **Step 5: Create the GitHub Release**

Create a non-draft, non-prerelease GitHub Release titled `Codex Pet Desktop v1.0.0`, use concise public release notes, and attach the installer plus checksum.

Expected: The release page is public and both files are downloadable.

- [ ] **Step 6: Verify published state**

Confirm repository visibility, default branch SHA, tag SHA, release URL, asset names/sizes, and GitHub Actions status for the release commit.

Expected: Public `main`, `v1.0.0`, release metadata, artifacts, and CI all correspond to the same tested source revision.
