# Cloud Terminal Pet Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Windows tray, executable, shortcuts, installer, and uninstaller one visible original cloud-terminal-pet icon.

**Architecture:** Store a transparent, project-owned master PNG under `assets/branding`. Generate deterministic multi-size PNG/ICO derivatives from that master, package a small PNG as an external runtime resource for the Electron tray, and continue embedding the ICO through Electron Packager and electron-builder.

**Tech Stack:** Built-in image generation, chroma-key alpha removal, PNGJS, png-to-ico, Electron `nativeImage`, Electron Packager, electron-builder, Vitest.

## Global Constraints

- Create an original mark; do not copy the Codex logo exactly.
- Preserve the cloud plus terminal prompt idea while adding a friendly pet silhouette.
- Keep the mark readable at 16×16 on light and dark Windows taskbars.
- Use a transparent background with no watermark or unrelated text.
- Do not alter local Pokémon assets.

---

### Task 1: Create and validate the branding master

**Files:**

- Create: `assets/branding/cloud-terminal-pet-source.png`
- Test: `tests/app-icon.test.ts`

**Interfaces:**

- Produces: a square RGBA PNG with transparent corners, a centered high-contrast silhouette, and the terminal glyph `>_`.

- [ ] **Step 1: Generate the original icon concept on a flat chroma-key background with the built-in image tool.**
- [ ] **Step 2: Remove the chroma key with the installed imagegen helper and save the final alpha PNG in `assets/branding`.**
- [ ] **Step 3: Inspect the full image and 16/24/32 px previews for silhouette, transparency, and glyph legibility.**
- [ ] **Step 4: Add a failing test that requires the generator to use the new branding master instead of the built-in pet preview.**

### Task 2: Generate Windows and tray derivatives

**Files:**

- Modify: `scripts/generate-app-icons.mjs`
- Generate: `build/generated/icon.ico`
- Generate: `build/generated/icon.png`
- Generate: `build/generated/tray-icon.png`
- Test: `tests/app-icon.test.ts`

**Interfaces:**

- Consumes: `assets/branding/cloud-terminal-pet-source.png`.
- Produces: 16, 24, 32, 48, 64, 128, and 256 px PNGs; a multi-size ICO; and a 32 px runtime tray PNG.

- [ ] **Step 1: Update the test to verify the source path, transparent corners, non-empty center, ICO sizes, and tray PNG dimensions.**
- [ ] **Step 2: Run `npx vitest run tests/app-icon.test.ts` and confirm failure against the old preview source.**
- [ ] **Step 3: Update the generator to use high-quality RGBA downsampling appropriate for a clean icon master and write `tray-icon.png`.**
- [ ] **Step 4: Run the generator and focused test; require PASS.**

### Task 3: Use the icon in the tray and packaged resources

**Files:**

- Create: `src/main/app-icon-path.ts`
- Modify: `src/main/tray-manager.ts`
- Modify: `src/main/index.ts`
- Modify: `scripts/package-app.mjs`
- Modify: `electron-builder.json`
- Test: `tests/app-icon-path.test.ts`
- Modify: `tests/installer-config.test.ts`

**Interfaces:**

- Produces: `resolveTrayIconPath({ packaged, resourcesPath, cwd })`.
- Consumes: runtime `build/generated/tray-icon.png` in development and `resources/tray-icon.png` when packaged.

- [ ] **Step 1: Write failing path and installer-resource tests.**
- [ ] **Step 2: Replace the inline tray SVG with `nativeImage.createFromPath`, reject an empty image, and use the packaged resource path.**
- [ ] **Step 3: Copy `tray-icon.png` through both package flows while preserving embedded `icon.ico` for the EXE and shortcuts.**
- [ ] **Step 4: Run focused tray, packaging, and installer tests; require PASS.**

### Task 4: Verify and package

**Files:**

- Package: `release/Codex Pet Desktop-win32-x64/`
- Package: `release/m3-3/codex-pet-desktop-0.1.0-setup-x64.exe`

**Interfaces:**

- Produces: a running tray icon, icon-bearing EXE, and updated installer checksum.

- [ ] **Step 1: Run format, lint, all tests, and build; require PASS.**
- [ ] **Step 2: Rebuild the unpacked app and inspect the EXE icon plus live notification-area icon.**
- [ ] **Step 3: Rebuild the installer and verify its ICO/resource configuration and checksum.**
- [ ] **Step 4: Leave the corrected application running for user review.**
