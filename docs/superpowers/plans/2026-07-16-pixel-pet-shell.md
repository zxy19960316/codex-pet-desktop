# Pixel Pet Product Shell Implementation Plan

**Implementation status (2026-07-16):** The shell tasks below are implemented and visually
verified. The same change set also delivered the follow-up official Hook event bridge, bounded
receiver, conflict-preserving explicit installer, and privacy tests.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the developer-panel-first desktop window with a compact, manifest-driven 2D pixel pet that matches the user's sketch and can expand to show details or human-action cards.

**Architecture:** Keep the existing secure Electron/main/preload/React boundaries. Add a small theme resolver that maps normalized `PetState` values to sprite animation definitions, render one bundled original sprite sheet with integer pixel scaling, and let the main process resize the existing window between compact and expanded modes while preserving its lower-right anchor.

**Tech Stack:** Electron 43, React 19, TypeScript 6, Vite 8, Vitest 4, CSS sprite animation, SVG sprite assets.

## Global Constraints

- Windows 10/11 remains the primary target.
- The compact window target is `300 x 360`; the expanded window remains `420 x 700` for existing request cards.
- The renderer remains sandboxed with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Do not copy Clawd on Desk source or assets.
- Do not commit Pokemon artwork, sounds, logos, fonts, names, or extracted game resources.
- The bundled example character must be original; user-owned packs remain Git-ignored.
- Pixel assets render with nearest-neighbor scaling and no blur.
- M2.6 verification remains available only in explicit development mode and is not part of the normal product surface.

---

## File map

- `themes/example-original-pet/manifest.json`: bundled theme metadata and state-to-animation map.
- `themes/example-original-pet/assets/pixel-sprout.svg`: bundled original sprite sheet.
- `src/shared/pet-manifest.ts`: validated theme and animation contracts.
- `src/renderer/pet/builtin-theme.ts`: imports the bundled asset through Vite and produces a trusted runtime theme.
- `src/renderer/pet/pet-animation.ts`: pure state fallback and CSS frame calculations.
- `src/renderer/pet/Pet.tsx`: sprite renderer and accessible state description.
- `src/renderer/hud/CompactHud.tsx`: two quota rows and expand control from the sketch.
- `src/renderer/app/App.tsx`: compact-first composition; cards and diagnostics are progressive.
- `src/main/window-manager.ts`: compact/expanded sizes and anchor-preserving resize.
- `src/main/index.ts`: chooses window mode from the published snapshot.
- `src/core/pet/state-machine.ts`: terminal transient restoration to idle.
- `tests/pet-animation.test.ts`: fallback and sprite math.
- `tests/window-layout.test.ts`: mode selection and anchored bounds.
- `tests/pet-state.test.ts`: terminal restoration behavior.

### Task 1: Define a usable sprite theme contract

**Files:**

- Modify: `src/shared/pet-manifest.ts`
- Create: `src/renderer/pet/pet-animation.ts`
- Test: `tests/pet-animation.test.ts`

**Interfaces:**

- Produces `SpriteAnimation` with `row`, `frames`, `frameWidth`, `frameHeight`, `durationMs`, and `loop`.
- Produces `RuntimePetTheme` with a trusted bundled `imageUrl`, sheet dimensions, animation map, and fallback map.
- Produces `resolvePetAnimation(theme, state)` and `spriteStyle(theme, animation)`.

- [ ] **Step 1: Write failing fallback and frame-math tests**

```ts
it("falls approval back to waiting and computes integer sprite geometry", () => {
  expect(resolvePetAnimation(theme, "approval").state).toBe("waiting_input");
  expect(spriteStyle(theme, theme.animations.idle)).toMatchObject({
    width: "64px",
    height: "64px",
    backgroundSize: "256px 256px",
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing exports fail**

Run: `npm test -- tests/pet-animation.test.ts`

Expected: FAIL because `pet-animation.ts` and the runtime types do not exist.

- [ ] **Step 3: Implement the exact runtime contracts**

```ts
export interface SpriteAnimation {
  row: number;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  durationMs: number;
  loop: boolean;
}

export interface RuntimePetTheme extends PetManifest {
  imageUrl: string;
  sheetWidth: number;
  sheetHeight: number;
  animations: Partial<Record<PetState, SpriteAnimation>>;
  fallbacks: Partial<Record<PetState, PetState>>;
}
```

`resolvePetAnimation` must cap fallback traversal at `PET_STATES.length`, reject cycles, and fall
back to `idle`. `spriteStyle` must return only calculated CSS strings and must not accept arbitrary
paths.

- [ ] **Step 4: Re-run the focused test**

Run: `npm test -- tests/pet-animation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pet-manifest.ts src/renderer/pet/pet-animation.ts tests/pet-animation.test.ts
git commit -m "feat: define pixel pet animation contract"
```

### Task 2: Add an original bundled pixel theme

**Files:**

- Create: `themes/example-original-pet/assets/pixel-sprout.svg`
- Modify: `themes/example-original-pet/manifest.json`
- Create: `src/renderer/pet/builtin-theme.ts`
- Modify: `src/renderer/pet/Pet.tsx`
- Modify: `src/renderer/styles/pet.css`

**Interfaces:**

- Consumes `RuntimePetTheme`, `resolvePetAnimation`, and `spriteStyle` from Task 1.
- Produces `BUILTIN_PIXEL_THEME` and a `Pet` component that renders a sprite only.

- [x] **Step 1: Create one original 4 x 4 pixel sprite sheet**

Use the paper sketch only as a silhouette/composition reference. The image-generation service timed
out, so the fallback is an original code-drawn crisp-edge SVG with no Pokémon character,
branding, text, or watermark.

- [ ] **Step 2: Define the bundled theme map**

```ts
export const BUILTIN_PIXEL_THEME: RuntimePetTheme = {
  id: "pixel-sprout",
  displayName: "Pixel Sprout",
  imageUrl: spriteSheetUrl,
  sheetWidth: 256,
  sheetHeight: 256,
  animations: {
    idle: { row: 0, frames: 4, frameWidth: 64, frameHeight: 64, durationMs: 900, loop: true },
    thinking: { row: 1, frames: 4, frameWidth: 64, frameHeight: 64, durationMs: 700, loop: true },
    working: { row: 2, frames: 4, frameWidth: 64, frameHeight: 64, durationMs: 520, loop: true },
    success: { row: 3, frames: 4, frameWidth: 64, frameHeight: 64, durationMs: 800, loop: false },
  },
  fallbacks: {
    typing: "working",
    approval: "thinking",
    waiting_input: "thinking",
    error: "thinking",
    sleeping: "idle",
    quota_low: "idle",
    quota_exhausted: "sleeping",
  },
};
```

- [ ] **Step 3: Replace the CSS-div pet with the sprite renderer**

Render a single `.pet-sprite` div with `aria-hidden="true"`; keep the state label only as visually
hidden accessible text. Set CSS custom properties for the resolved row, frame count, duration, and
scale. Use `image-rendering: pixelated`, `steps(var(--pet-frames))`, and integer `scale: 3`.

- [ ] **Step 4: Build and inspect the asset path**

Run: `npm run build`

Expected: Vite imports the trusted SVG URL; no filesystem path is exposed to the renderer.

- [ ] **Step 5: Commit**

```bash
git add themes/example-original-pet src/renderer/pet src/renderer/styles/pet.css
git commit -m "feat: render an original pixel pet theme"
```

### Task 3: Build the sketch-shaped compact HUD

**Files:**

- Create: `src/renderer/hud/CompactHud.tsx`
- Modify: `src/renderer/hud/hud-view-model.ts`
- Modify: `src/renderer/app/App.tsx`
- Modify: `src/renderer/styles/base.css`
- Test: `tests/hud-view-model.test.ts`

**Interfaces:**

- Produces `selectCompactBuckets(rateLimits)` returning the shortest window followed by the weekly
  window, with unavailable placeholders when data is missing.
- `CompactHud` always renders two rows and calls `window.codexPet.toggleHud()` from the expand
  button.

- [ ] **Step 1: Add failing compact-bucket selection tests**

```ts
expect(selectCompactBuckets([weekly, fiveHour])).toEqual([fiveHour, weekly]);
expect(selectCompactBuckets(null)).toEqual([null, null]);
```

- [ ] **Step 2: Implement deterministic bucket selection and labels**

The first row label is `5h` for the shortest finite reset window. The second is `weekly` for a
window of at least five days; otherwise use the next longest bucket. Never invent percentages.

- [ ] **Step 3: Compose the compact shell**

The normal render order must be `CompactHud -> Pet`. Expanded `Hud`, approval/reply cards, and
developer panels follow beneath. Remove the permanent connection drag bar and the visible state
pill.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- tests/hud-view-model.test.ts && npm run build`

Expected: PASS and no overflow in the `300 x 360` compact layout.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hud src/renderer/app/App.tsx src/renderer/styles/base.css tests/hud-view-model.test.ts
git commit -m "feat: add compact quota pet shell"
```

### Task 4: Resize between compact and expanded modes

**Files:**

- Modify: `src/main/window-manager.ts`
- Modify: `src/main/index.ts`
- Create: `src/main/window-layout.ts`
- Test: `tests/window-layout.test.ts`

**Interfaces:**

- Produces `WindowMode = "compact" | "expanded"`.
- Produces `windowModeForSnapshot(snapshot)`.
- Produces `resizeFromBottomRight(bounds, targetSize, workArea)`.
- Adds `WindowManager.setMode(mode)`.

- [ ] **Step 1: Write failing layout tests**

```ts
expect(windowModeForSnapshot(compactSnapshot)).toBe("compact");
expect(windowModeForSnapshot({ ...compactSnapshot, approvals: [approval] })).toBe("expanded");
expect(
  resizeFromBottomRight(
    { x: 100, y: 100, width: 420, height: 700 },
    { width: 300, height: 360 },
    workArea,
  ),
).toMatchObject({ x: 220, y: 440, width: 300, height: 360 });
```

- [ ] **Step 2: Implement pure window-mode rules**

Use expanded mode when `hudVisible`, `debugVisible`, `approvals.length > 0`, or
`userInputs.length > 0`; compact otherwise. Preserve the old bottom-right edge when resizing and
clamp the result to the nearest work area.

- [ ] **Step 3: Apply mode during every published snapshot**

Call `windowManager.setMode(windowModeForSnapshot(snapshot))` before sending the snapshot to the
renderer. The method must no-op when the mode is unchanged.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- tests/window-layout.test.ts && npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/window-layout.ts src/main/window-manager.ts src/main/index.ts tests/window-layout.test.ts
git commit -m "feat: add compact and expanded pet windows"
```

### Task 5: Fix terminal state and remove verifier-first defaults

**Files:**

- Modify: `src/core/pet/state-machine.ts`
- Modify: `src/main/runtime-controller.ts`
- Modify: `src/shared/settings.ts`
- Modify: `src/renderer/app/App.tsx`
- Test: `tests/pet-state.test.ts`

**Interfaces:**

- Adds optional `transientReturnState` to `PetStateChange`.
- Terminal success/error events return to `idle`, not to stale `working`.
- Default `hudVisible` becomes `false`; debug remains `false`.

- [ ] **Step 1: Add the failing terminal-return test**

```ts
machine.update(working);
machine.update({ ...success, transientReturnState: "idle" });
await vi.advanceTimersByTimeAsync(3000);
expect(machine.getGlobalState()).toBe("idle");
```

- [ ] **Step 2: Implement explicit transient return state**

Use `change.transientReturnState ?? priorStable` when the transient timer completes. The event
normalizer/runtime must set `transientReturnState: "idle"` for terminal turn success or failure.

- [ ] **Step 3: Keep M2.6 behind the explicit `--m2-6-e2e` flag**

Normal `npm run dev` must never render the verification guide. Existing verifier code can remain
for regression work, but it cannot affect compact-mode defaults or product milestone gating.

- [ ] **Step 4: Run all quality gates**

Run: `npm run format && npm run format:check && npm run lint && npm test && npm run build`

Expected: formatting, lint, all test files, type checking, renderer build, main bundle, and preload
bundle pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/pet src/main/runtime-controller.ts src/shared/settings.ts src/renderer/app/App.tsx tests/pet-state.test.ts
git commit -m "fix: return completed pet activity to idle"
```

### Task 6: Desktop visual acceptance

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Modify: `docs/reports/2026-07-16_PRODUCT_RESET_AUDIT.md`

**Interfaces:**

- Produces a screenshot of compact mode and expanded mode under `tmp/visual-qa/` (Git-ignored).
- Produces measured window bounds and a manual checklist result.

- [ ] **Step 1: Launch compact Mock mode and capture the window**

Run the app with deterministic Mock usage, wait for the renderer, capture `BrowserWindow` output,
and verify `300 x 360`, transparent corners, two quota rows, nearest-neighbor pixels, and no debug
panel.

- [ ] **Step 2: Expand the HUD and capture again**

Verify the lower-right anchor remains stable, existing HUD content is usable, and collapse returns
to the compact bounds.

- [ ] **Step 3: Exercise every pet state from the development control**

Verify each normalized state resolves to a valid animation and no state produces a missing image,
blank stage, blurred scaling, or layout shift.

- [ ] **Step 4: Update documentation with measured evidence**

Record the actual test count, compact and expanded dimensions, asset filename, and any remaining
visual issues. State clearly that real external Codex observation belongs to the separate hook
bridge plan.

- [ ] **Step 5: Commit and push**

```bash
git add README.md docs/architecture/ARCHITECTURE.md docs/reports/2026-07-16_PRODUCT_RESET_AUDIT.md
git commit -m "docs: reset roadmap around the pixel pet"
git push origin main
```

## Self-review

- Spec coverage: the sketch's two quota rows, expand control, central pixel pet, compact default,
  and progressive UI each map to a task.
- Placeholder scan: every task names exact files, interfaces, commands, and expected behavior.
- Type consistency: all later tasks consume `RuntimePetTheme`, `SpriteAnimation`, `WindowMode`, and
  `transientReturnState` with the exact names defined earlier.
- Scope boundary: observing external Codex sessions is intentionally a second plan because hook
  installation, trust, health checks, and event transport form an independently testable subsystem.
