# Pet Shape Animation Regression Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the full visible pet while preserving mouse-through behavior outside the pet and battle HUD.

**Architecture:** Use Electron's Chromium-rendered sprite capture as the alpha source instead of decoding local WebP assets through `nativeImage.createFromPath`, which is not reliable for these local sheets. Convert the captured current frame into a shaped region, discard stale asynchronous captures, and keep a safe sprite bounding region whenever capture or alpha extraction fails.

**Tech Stack:** Electron 43, React 19, TypeScript, CSS animations, Vitest, Windows shaped windows.

## Global Constraints

- Preserve local-only third-party pet assets and do not bundle or publish them.
- Preserve transparent-area mouse-through behavior.
- Do not claim human click-through verification from automated screenshots.
- Reproduce animation/state transitions, not only the first idle frame.

---

### Task 1: Reproduce and isolate the native WebP alpha failure

**Files:**

- Modify: `src/main/pet-window-shape.ts`
- Test: `tests/pet-window-shape.test.ts`

**Interfaces:**

- Consumes: a rendered RGBA capture and its destination rectangle.
- Produces: a DPI-normalized alpha region with a non-empty sprite fallback.

- [ ] **Step 1: Write failing rendered-capture tests**

  Cover a 2x RGBA capture mapped into a 1x renderer rectangle and a fully transparent/failed capture that must return the sprite rectangle rather than UI-only shape.

- [ ] **Step 2: Run the focused test and verify failure**

  Run `npx vitest run tests/pet-window-shape.test.ts`; require a failure because the rendered-capture helper does not exist.

- [ ] **Step 3: Add rendered-capture conversion**

  Add a helper that treats the full capture as one frame, scales physical capture pixels into renderer coordinates, and appends the existing UI rectangles.

- [ ] **Step 4: Add the non-empty fallback**

  When the capture has no usable alpha pixels, return the reported sprite rectangle plus UI rectangles so the pet cannot disappear.

- [ ] **Step 5: Run the focused tests**

  Require all pixel shape cases to pass.

### Task 2: Apply only the current rendered frame shape

**Files:**

- Modify: `src/main/window-manager.ts`
- Modify: `src/main/pet-window-shape.ts`
- Test: `tests/pet-window-shape.test.ts`

**Interfaces:**

- Consumes: the validated renderer geometry request.
- Produces: a Windows region captured from the same Chromium frame currently drawn on screen, plus battle HUD rectangles.

- [ ] **Step 1: Keep capture generations monotonic**

  Increment a generation for every shape request and discard capture results that finish after a newer request.

- [ ] **Step 2: Remove main-process WebP/state decoding**

  Capture the sprite rectangle through `webContents.capturePage`, including a small filter/shadow margin, and build the region from the captured bitmap rather than resolving a sprite URL and atlas row.

- [ ] **Step 3: Add a conservative fallback**

  If capture or shape generation fails, include the reported sprite rectangle with the UI rectangles so the pet remains visible instead of disappearing.

- [ ] **Step 4: Run focused tests**

  Run `npx vitest run tests/pet-window-shape.test.ts tests/ipc-validation.test.ts`; require PASS.

### Task 3: Verify animation longevity and package

**Files:**

- Modify: `src/main/smoke-validation.ts`
- Package: `release/Codex Pet Desktop-win32-x64/`
- Package: `release/m3-3/codex-pet-desktop-0.1.0-setup-x64.exe`

**Interfaces:**

- Consumes: packaged app with live stepped animation.
- Produces: startup and delayed screenshots plus a native complex-region probe.

- [ ] **Step 1: Capture startup and delayed animation evidence**

  Capture after at least one full animation loop and confirm the sprite has a substantial non-transparent component below the HUD.

- [ ] **Step 2: Run all repository gates**

  Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`; require PASS.

- [ ] **Step 3: Rebuild application and installer**

  Run `npm run package:dir` and `npm run package:installer`; verify the installer checksum is regenerated.

- [ ] **Step 4: Launch the corrected preview**

  Stop only the preview executable created by this task, launch the rebuilt unpacked app, and leave it running for the user's human click-through check.
