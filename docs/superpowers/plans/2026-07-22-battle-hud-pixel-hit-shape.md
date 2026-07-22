# Battle HUD and Pixel-Accurate Window Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized HP/MP panel with a compact Pokémon-battle-style Agent HUD and make the compact desktop window draw and receive mouse input only on the HUD and the sprite's non-transparent pixels.

**Architecture:** The renderer reports current sprite geometry, animation frame, and visible UI rectangles through a validated one-way IPC channel. On Windows, the main process reads the active local sprite through Electron `nativeImage`, converts alpha runs into a bounded window region, and applies `BrowserWindow.setShape`, which makes pixels outside the region both invisible and mouse-through. A read-only Codex session monitor extracts only the newest model, effort, current-turn token count, context-window size, and active rate-limit windows from the newest local JSONL session, then publishes that normalized telemetry through the existing desktop snapshot.

**Tech Stack:** Electron 43, React 19, TypeScript, CSS, Vitest, Electron `BrowserWindow.setShape` and `nativeImage`.

## Global Constraints

- Keep third-party Pokémon assets local-only and outside Git/installers.
- Never expose raw session content, prompts, paths, or session identifiers to the renderer.
- Preserve full click-through mode and expanded approval/reply controls.
- Keep automated, packaged, and human evidence separate.

---

### Task 1: Normalize live Agent telemetry

**Files:**

- Create: `src/core/codex/session-telemetry.ts`
- Create: `src/main/codex-session-monitor.ts`
- Modify: `src/core/codex/usage-provider.ts`
- Modify: `src/main/runtime-controller.ts`
- Modify: `src/shared/ipc-contract.ts`
- Modify: `src/main/index.ts`
- Test: `tests/session-telemetry.test.ts`

**Interfaces:**

- Produces: `AgentTelemetry { model, reasoningEffort, currentTokens, contextWindowTokens, rateLimits }`.
- Consumes: only `turn_context` and `event_msg.payload.type === "token_count"` JSONL records.

- [ ] Write a failing parser test covering `gpt-5.6-sol`, `high`, `178807 / 258400`, and a weekly-only rate limit.
- [ ] Implement a strict line parser that ignores all non-telemetry fields and returns no raw session data.
- [ ] Implement a monitor that selects the most recently written session under today's/yesterday's date folders and emits only changed telemetry.
- [ ] Add telemetry to `DesktopSnapshot`; prefer its current tokens, context window, and rate limits over the isolated App Server snapshot.
- [ ] Run `npx vitest run tests/session-telemetry.test.ts tests/snapshot-assembler.test.ts` and require PASS.

### Task 2: Apply a pixel-accurate Windows window shape

**Files:**

- Create: `src/main/pet-window-shape.ts`
- Create: `src/renderer/pet/window-shape-reporter.ts`
- Modify: `src/shared/ipc-contract.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/window-manager.ts`
- Modify: `src/renderer/pet/Pet.tsx`
- Test: `tests/pet-window-shape.test.ts`
- Modify: `tests/ipc-validation.test.ts`

**Interfaces:**

- Consumes: validated `WindowShapeRequest { frameIndex, spriteRect, uiRects }` in renderer coordinates.
- Produces: merged integer Electron rectangles covering sprite alpha runs plus visible UI rectangles.

- [ ] Write failing tests for transparent pixels, vertically merged alpha runs, scaled sprite placement, rectangle validation, and the maximum request size.
- [ ] Implement bitmap-alpha to window-rectangle conversion with injected image loading for unit tests.
- [ ] Add a renderer reporter that sends only when animation frame or geometry changes and marks visible HUD/cards as UI shape rectangles.
- [ ] Apply `BrowserWindow.setShape` only on Windows/Linux; retain full-window behavior while expanded until the visible controls have reported geometry.
- [ ] Ensure `clickThrough=true` still ignores all mouse input and `clickThrough=false` restores shaped interaction.
- [ ] Run focused shape and IPC tests and require PASS.

### Task 3: Rebuild the battle-style adaptive HUD

**Files:**

- Modify: `src/renderer/hud/hud-view-model.ts`
- Modify: `src/renderer/pet/PetResourceBars.tsx`
- Modify: `src/renderer/hud/CompactHud.tsx`
- Modify: `src/renderer/app/App.tsx`
- Modify: `src/renderer/pet/Pet.tsx`
- Modify: `src/renderer/styles/pet.css`
- Modify: `src/renderer/pet/pet-state-overlay.css`
- Modify: `src/main/pet-window-layout.ts`
- Modify: `tests/hud-view-model.test.ts`
- Modify: `tests/pet-window-layout.test.ts`

**Interfaces:**

- Consumes: Agent telemetry plus `computePetVisualMetrics`.
- Produces: adaptive panel width `max(120, petVisualWidth + 12)`, model/effort header, optional `5H`, required/available `WEEKLY`, and `currentTokens / contextWindowTokens` footer.

- [ ] Write failing view-model tests showing weekly-only rendering when no 300-minute bucket exists and both `5H`/`WEEKLY` when both exist.
- [ ] Replace HP/MP copy and circular toggle with the reference image's cream panel, dark outline, compact header, thin bars, and numeric footer.
- [ ] Clamp model and effort labels, abbreviate token counts without fabricating unavailable values, and keep the details toggle keyboard-accessible.
- [ ] Reduce compact window chrome so the window tracks the scaled pet plus HUD instead of retaining the old 300×360 minimum.
- [ ] Run focused HUD/layout tests and capture a packaged compact screenshot for visual inspection.

### Task 4: Full verification and preview

**Files:**

- Verify: all changed source/test/config files
- Package: `release/Codex Pet Desktop-win32-x64/`
- Package: `release/m3-3/codex-pet-desktop-0.1.0-setup-x64.exe`

- [ ] Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`.
- [ ] Run `npm run package:dir` and confirm the external Hook receiver remains present.
- [ ] Run packaged compact smoke capture; inspect that the HUD is only slightly wider than the current sprite and that weekly-only quota collapses correctly.
- [ ] Launch the final unpacked app for user review; do not claim native pixel hit-testing as human-verified until clicks behind transparent pixels are observed manually.
