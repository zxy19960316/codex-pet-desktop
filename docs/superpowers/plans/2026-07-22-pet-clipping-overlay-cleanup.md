# Pet Clipping and Overlay Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the complete scaled pet in every compact animation state and remove the circular state-symbol overlay, including the sleeping `Z` bubble.

**Architecture:** Keep state meaning in sprite animation and accessible text only; do not render a separate state overlay. Compute compact window and stage padding from the transformed frame bounds, then verify the Chromium sprite rectangle and Windows region remain inside the window on all four edges.

**Tech Stack:** Electron 43, React 19, TypeScript, CSS, Vitest, Windows shaped windows.

## Global Constraints

- Preserve pixel-shaped mouse-through behavior.
- Preserve battle HUD size and live telemetry content.
- Keep local Pokémon assets outside Git and installers.
- Use real system-window screenshots for clipping evidence.

---

### Task 1: Remove the state-symbol overlay

**Files:**

- Modify: `src/renderer/pet/Pet.tsx`
- Delete: `src/renderer/pet/PetStateOverlay.tsx`
- Delete: `src/renderer/pet/pet-state-overlay.css`
- Modify: `src/renderer/main.tsx`
- Modify: `src/renderer/pet/window-shape-reporter.ts`
- Test: `tests/pet-state-overlay.test.ts`

**Interfaces:**

- Consumes: `PetState` for sprite animation and the visually hidden accessible label.
- Produces: no `.pet-state-overlay` DOM element or window-shape rectangle.

- [ ] **Step 1: Change the existing overlay test to require no rendered overlay component.**
- [ ] **Step 2: Run `npx vitest run tests/pet-state-overlay.test.ts` and verify it fails against the current component.**
- [ ] **Step 3: Remove the component, stylesheet import, and shape selector while retaining `.visually-hidden` state text.**
- [ ] **Step 4: Run the focused test and renderer boundary tests; require PASS.**

### Task 2: Prevent transformed sprite clipping

**Files:**

- Modify: `src/main/pet-window-layout.ts`
- Modify: `src/renderer/pet/Pet.tsx`
- Modify: `src/renderer/styles/pet.css`
- Test: `tests/pet-window-layout.test.ts`

**Interfaces:**

- Consumes: `PetVisualMetrics { width, height }` at 50–200% scale.
- Produces: compact bounds with explicit left/right/bottom safety margins around the transformed sprite and HUD.

- [ ] **Step 1: Add failing layout assertions requiring the sprite frame plus 16 px horizontal and 12 px bottom safety to fit at 50%, 100%, and 200%.**
- [ ] **Step 2: Run `npx vitest run tests/pet-window-layout.test.ts` and confirm the current compact bounds fail the new edge requirement.**
- [ ] **Step 3: Increase only the compact safety chrome and align the stage/sprite so the complete transformed frame stays inside the viewport.**
- [ ] **Step 4: Run layout, shape, and window tests; require PASS.**

### Task 3: Verify and package

**Files:**

- Package: `release/Codex Pet Desktop-win32-x64/`
- Package: `release/m3-3/codex-pet-desktop-0.1.0-setup-x64.exe`

**Interfaces:**

- Consumes: corrected compact layout and overlay-free renderer.
- Produces: live preview, system screenshot, and updated installer checksum.

- [ ] **Step 1: Capture the real Windows window at 200% display DPI after multiple animation frames.**
- [ ] **Step 2: Confirm no edge of the sprite alpha touches the window boundary and no circular state overlay is present.**
- [ ] **Step 3: Run format, lint, all tests, and build; require PASS.**
- [ ] **Step 4: Rebuild unpacked app and installer, then leave the corrected preview running.**
