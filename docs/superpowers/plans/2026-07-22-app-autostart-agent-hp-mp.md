# Installed App, Automatic Codex Detection, and HP/MP HUD Plan

**Goal:** Make Codex Pet usable as a normal Windows app, optionally launch it at sign-in, automatically attach its supported Codex activity sources, and show quota as game-style HP/MP bars fixed above the moving pet.

**Architecture:** Keep the Electron renderer sandboxed. Persist the new sign-in preference in Settings v3 with backward-compatible parsing, and let a small main-process controller translate it into Electron login-item settings only for packaged builds. Start the local Codex App Server by default and idempotently install the existing local Hook integration at app startup; replay only recent hook events so an already-running agent can be recognized without treating stale history as live. Replace the detached compact quota panel with an in-stage resource overlay, while retaining the detailed HUD behind its expand control.

**Tech Stack:** Electron, React, TypeScript, CSS, Vitest, electron-builder/NSIS.

---

### Task 1: Lock behavior with focused tests

**Files:**

- Modify: `tests/settings-migrations.test.ts`
- Modify: `tests/settings-service.test.ts`
- Modify: `tests/settings-ipc-validation.test.ts`
- Create: `tests/launch-at-login.test.ts`
- Modify: `tests/hud-view-model.test.ts`
- Create: `tests/hook-event-bridge.test.ts`

Add failing tests for backward-compatible `launchAtLogin`, packaged-only login registration, HP/MP quota mapping and clamping, and recent-event startup replay.

### Task 2: Add installed-app and launch-at-login behavior

**Files:**

- Modify: `src/shared/settings.ts`
- Modify: `src/shared/ipc/settings-ipc.ts`
- Modify: `src/main/settings/settings-migrations.ts`
- Modify: `src/main/settings/settings-service.ts`
- Modify: `src/main/settings/settings-ipc-handlers.ts`
- Create: `src/main/launch-at-login.ts`
- Modify: `src/main/runtime-controller.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/settings/SettingsApp.tsx`
- Modify: `electron-builder.json`

Expose the option in General settings, synchronize it in the main process, and make the installer create normal Windows desktop and Start menu shortcuts.

### Task 3: Automatically attach supported Codex activity

**Files:**

- Modify: `src/main/index.ts`
- Modify: `src/main/hook-event-bridge.ts`

Enable App Server startup by default, install the Hook configuration idempotently at app startup, keep the explicit tray action for repair/review, and replay only recent valid hook events on bridge startup. Preserve Codex's one-time Hook trust requirement.

### Task 4: Attach game-style HP/MP bars to the pet

**Files:**

- Modify: `src/renderer/hud/hud-view-model.ts`
- Create: `src/renderer/pet/PetResourceBars.tsx`
- Modify: `src/renderer/pet/Pet.tsx`
- Modify: `src/renderer/app/App.tsx`
- Modify: `src/renderer/hud/CompactHud.tsx`
- Modify: `src/renderer/styles/base.css`
- Modify: `src/renderer/styles/pet.css`

Map the shortest quota window to HP and the weekly/longest window to MP. Render bounded percentages, disconnected placeholders, and a small details toggle as one overlay inside the pet stage so it follows every window move.

### Task 5: Verify and package a preview

Run focused tests, then the full `format:check`, `lint`, `test`, and `build` gates. Produce an unpacked Windows app with `package:dir`, inspect the generated executable/resources, and run the existing compact smoke capture if safe. Keep automated, packaged, and human evidence separate.
