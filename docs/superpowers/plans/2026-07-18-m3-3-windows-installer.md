# M3.3 Windows Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a branded Windows NSIS installer, prepare secret-only Authenticode signing, and prove unattended install, packaged Pet Settings startup, and uninstall in an isolated directory.

**Architecture:** The existing Vite/esbuild output remains the only application input. A deterministic icon generator derives Windows icon sizes from the committed original Pixel Sprout preview; electron-builder packages `dist/` into `app.asar`, copies reviewed `pets/` as external resources, and creates a per-user NSIS installer. A Windows-only verifier installs into a unique `%TEMP%` directory, drives the installed EXE through the existing gated Settings verifier, invokes the generated uninstaller, and writes machine-readable evidence before removing only its own temporary user-data.

**Tech Stack:** TypeScript 6, Electron 43, React 19, Vitest 4, electron-builder 26, NSIS, png-to-ico 3, pngjs 7, GitHub Actions.

## Global Constraints

- Do not add third-party character, game, sound, logo, font, or installer artwork.
- Derive icons only from `pets/example-original-pet/preview.png`.
- Do not modify Codex communication, App Server, Hook, quota, or `RuntimeController` behavior.
- Do not enable publishing, auto-update, or automatic GitHub Release creation.
- Do not commit certificates, passwords, signing outputs, or local installer verification data.
- Normal unsigned builds must remain available; signed builds must fail before packaging unless both `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` exist.
- Automated installation must be per-user, create no desktop/start-menu shortcut, and use an exact unique directory below `os.tmpdir()`.
- Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build` before every commit.
- Never reset, force-push, or rewrite published history.

---

### Task 1: Original application icon and distribution metadata

**Files:**

- Create: `scripts/generate-app-icons.mjs`
- Create: `tests/app-icon.test.ts`
- Modify: `scripts/package-app.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

**Interfaces:**

- Produces: `npm run assets:icons`.
- Produces: ignored `build/generated/icon.png` and `build/generated/icon.ico`.
- Consumes: the committed original `pets/example-original-pet/preview.png`.

- [x] **Step 1: Add a failing icon-generation test**

Run the icon script from Vitest, require PNG dimensions `256 x 256`, require ICO magic bytes
`00 00 01 00`, and require embedded sizes `16, 24, 32, 48, 64, 128, 256`.

- [x] **Step 2: Implement deterministic nearest-neighbor icon generation**

Decode the original 128-pixel preview with `pngjs`, scale it without interpolation, write the
256-pixel PNG, and pass all seven generated sizes to `png-to-ico`. No new drawing source is allowed.

- [x] **Step 3: Connect metadata and the unpacked package icon**

Add repository author/homepage metadata, run `assets:icons` before `package:dir`, and pass the ICO
to `@electron/packager` while retaining existing Windows version metadata.

- [x] **Step 4: Run gates and commit**

Expected: four global gates pass; icon tests pass; `npm run package:dir` still contains
`resources/pets/example-original-pet/manifest.json`.

Commit: `feat: add original Windows app branding`

### Task 2: NSIS installer and signing preparation

**Files:**

- Create: `electron-builder.json`
- Create: `scripts/require-windows-signing.mjs`
- Create: `scripts/write-installer-checksum.mjs`
- Create: `tests/installer-config.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Produces: `npm run package:installer` for unsigned local artifacts.
- Produces: `npm run package:installer:signed`, gated by `WIN_CSC_LINK` and
  `WIN_CSC_KEY_PASSWORD` and electron-builder `forceCodeSigning`.
- Produces: `release/m3-3/codex-pet-desktop-${version}-setup-x64.exe` and matching `.sha256`.

- [x] **Step 1: Write failing installer configuration tests**

Assert stable `appId`, explicit `dist/**` files, external `pets`, x64 NSIS target, assisted
per-user install, changeable install directory, no shortcuts, no publish provider, generated icon,
and deterministic artifact name.

- [x] **Step 2: Add the electron-builder configuration**

Package `dist/` and the minimal root package metadata into `app.asar`; copy `pets/` to
`resources/pets`; use maximum compression and an x64 NSIS target under `release/m3-3/`.

- [x] **Step 3: Add signing and checksum guards**

The signing preflight must validate presence only and never print secret values. The checksum
writer must hash the one expected installer with SHA-256 and write the standard
`<hex>  <filename>` line.

- [x] **Step 4: Build the unsigned installer, run gates, and commit**

Expected: installer and checksum exist; Authenticode may report `NotSigned`; all four global gates
pass.

Commit: `feat: add Windows NSIS installer`

### Task 3: Isolated install, launch, and uninstall verifier

**Files:**

- Create: `scripts/run-m3-3-installer-e2e.mjs`
- Create: `tests/m3-3-installer-verifier.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**

- Produces: `npm run test:e2e:m3-3` for an existing installer.
- Produces: `npm run verify:m3-3` to build and verify the installer.
- Produces: ignored `tmp/m3-3-e2e/report.json` and `settings-installed.png`.

- [x] **Step 1: Write failing verifier contract tests**

Test report validation for installer hash, installed EXE, packaged Settings result, active imported
pet, both preview IDs, uninstaller exit, removed install directory, and explicit signature status.

- [x] **Step 2: Implement exact-path install and installed-app launch**

On Windows, run the installer silently with `/currentuser`, `/S`, and final
`/D=<unique os.tmpdir path>`. Launch the installed EXE with the existing explicit M3.2 import gate,
an isolated user-data directory, and a temporary fixture derived only from Pixel Sprout.

- [x] **Step 3: Invoke the real uninstaller and validate cleanup**

Run `Uninstall Codex Pet Desktop.exe /currentuser /S`, poll for the installation directory to
disappear, retain only the ignored report/screenshot, and remove only verifier-owned temporary
fixture/user-data directories.

- [x] **Step 4: Run full installer verification, gates, and commit**

Expected: `npm run verify:m3-3` passes install, installed Settings import/switch/preview, and real
uninstall. Four global gates also pass.

Commit: `test: add Windows installer lifecycle e2e`

### Task 4: Manual artifact CI without publishing

**Files:**

- Create: `.github/workflows/windows-installer.yml`
- Modify: `tests/ci-workflow.test.ts`

**Interfaces:**

- Produces: a `workflow_dispatch`-only Windows job that uploads installer, checksum, reports, and
  screenshot as a workflow artifact.
- Does not produce a GitHub Release and has `contents: read` only.

- [x] **Step 1: Add failing workflow-policy tests**

Require manual dispatch, Node 24, `npm ci`, `verify:m3-3`, artifact upload, read-only permissions,
and absence of `release`, `publish`, `contents: write`, and signing secret interpolation.

- [x] **Step 2: Add the manual installer workflow**

Use `windows-latest`, repository-approved checkout/setup-node major versions, and
`actions/upload-artifact@v4`. Set `CSC_IDENTITY_AUTO_DISCOVERY=false` for the unsigned verification
artifact.

- [x] **Step 3: Run gates and commit**

Expected: workflow policy tests and four global gates pass.

Commit: `ci: add manual Windows installer verification`

### Task 5: M3.3 documentation and publication

**Files:**

- Create: `docs/reports/M3_3_IMPLEMENTATION.md`
- Modify: `README.md`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Modify: `docs/plans/PROJECT_PLAN.md`
- Modify: this plan

**Interfaces:**

- Documents exact artifact names, commands, signing secrets, automated evidence, manual limits,
  and the distinction between unsigned verification and trusted signed distribution.

- [x] **Step 1: Record measured results**

Record test count, installer/checksum paths and sizes, signature status, install/launch/uninstall
fields, screenshot/report paths, and the absence of automatic publishing.

- [x] **Step 2: Run final gates and commit**

Commit: `docs: document M3.3 Windows distribution`

**Step 3: Push and verify**

Push `feat/m3-0-settings-center`, compare local HEAD with `git ls-remote`, and require a clean
worktree.

## Self-Review

- Spec coverage: branding, metadata, NSIS installer, signing preparation, install/start/uninstall proof, checksum, manual CI artifact, docs, commits, and push are covered.
- Placeholder scan: every deliverable has exact paths, commands, evidence, and expected behavior; no implementation placeholders remain.
- Type consistency: builder artifact names feed checksum and verifier scripts; the installed verifier reuses the gated Settings report contract; workflow paths match local evidence outputs.
