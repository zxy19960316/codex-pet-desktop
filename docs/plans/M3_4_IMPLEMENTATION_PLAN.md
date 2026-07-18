# M3.4 Codex PokéPets Experience Implementation Plan

> **For agentic workers:** Execute this plan task-by-task in the current branch. Keep every step
> testable, preserve the existing renderer/Main boundary, and run the repository quality gates
> before each focused commit.

**Goal:** Add local-only Codex PokéPets discovery/import, safe PNG/WebP pet assets, generic state
overlays, persistent 50–200% sizing with window bounds, and shared native pet/tray menus without
bundling or redistributing third-party character assets.

**Architecture:** The main process remains the only filesystem authority. `PetRegistry` validates
canonical packages and emits renderer-safe URLs/geometry; a dedicated provider discovers opaque
local source IDs and `CodexPokePetsAdapter` converts one explicitly chosen local package into the
managed `userData/pets` directory. Settings v3 owns presentation scale, `WindowManager` owns DIP
bounds/anchors, and renderer components receive only validated sprite metadata and typed actions.

**Tech stack:** TypeScript 6, Electron 43, React 19, CSS animations, Vitest, Vite, esbuild, Node.js
filesystem APIs, and a test-only Electron canvas generator for original synthetic WebP atlases.

## Global Constraints

- Baseline is `feat/m3-0-settings-center` at
  `c6668f5d649a5fa9c6856570f85a037ff56d8437`.
- Do not discard user changes, use `git reset --hard`, force-push, rewrite published history,
  modify `LICENSE`, publish a Release, or merge `main`.
- Pixel Sprout remains the only bundled/distributed pet; do not remove or relicense it.
- Do not modify Codex App Server, Hook, approval, quota, or structured-input protocol behavior.
- Never download, bundle, upload, or commit Pokémon art, sound, preview, GIF, logo, font, upstream
  `pets/`, source mirrors, credentials, certificates, cookies, user paths, or user-data caches.
- Read only local packages already installed below `${CODEX_HOME:-$HOME/.codex}/pets` or a folder
  explicitly chosen by the user. Imports stay below Electron `userData/pets`.
- Renderer code receives no Node/Electron/filesystem capability and never receives source paths.
- Canonical PNG packages remain fully compatible. Remote URLs, SVG, HTML, scripts, traversal,
  symlinks, and arbitrary extensions remain rejected.

---

## 1. Current Pet Package data chain

The existing chain is:

```text
manifest.json + local PNG files
  -> PetRegistry.validatePet()
  -> PetPackage with validated file:// URLs and sprite geometry
  -> DesktopSnapshot / SettingsWindowSnapshot
  -> AnimationResolver
  -> Pet.tsx / PetSelector.tsx
```

Selection remains in `userData/pets/.active-pet.json`; it must not move into Settings JSON.
Filesystem selection/import stays behind native main-process dialogs and narrow Settings IPC.

## 2. Codex PokéPets actual format

The local Windows discovery root is resolved at runtime from the home directory as
`<home>/.codex/pets`; no username is hard-coded. The directory existed during planning but
contained zero packages, so real local asset inspection and human import are `not run`.

Public upstream metadata was inspected without cloning or downloading sprites. Representative 2D
and 3D directories use the same minimal JSON:

```json
{
  "id": "source-id",
  "displayName": "Display name",
  "description": "Description",
  "spritesheetPath": "spritesheet.webp"
}
```

The source folder normally contains only `pet.json` and `spritesheet.webp` after installation.
The upstream JSON carries no frame count, row, FPS, author, or asset-license field.

## 3. `spritesheet.webp` actual structure

The current Codex atlas contract is `1536 x 1872`, eight columns by nine rows, with `192 x 208`
cells. It is a static WebP atlas, not a one-row horizontal sheet. The fixed rows are:

| Row | Codex state     | Used columns |
| --- | --------------- | ------------ |
| 0   | idle            | 0–5          |
| 1   | running-right   | 0–7          |
| 2   | running-left    | 0–7          |
| 3   | waving          | 0–3          |
| 4   | jumping         | 0–4          |
| 5   | failed          | 0–7          |
| 6   | waiting         | 0–5          |
| 7   | running/work    | 0–5          |
| 8   | review/thinking | 0–5          |

Unused cells are expected to be transparent. Because no local packages were present, this atlas
contract is verified from current public Codex documentation/source instructions, not from a real
local character file.

## 4. Adaptation strategy

`CodexPokePetsProvider` scans only immediate child directories under the configured local root,
checks safe source IDs, and returns `CodexPokePetDiscovery` records containing only source ID,
display name, compatibility, already-imported state, and a sanitized error. It never returns a
home directory or absolute path.

`CodexPokePetsAdapter` implements `ExternalPetAdapter<CodexPokePetSource>` and also provides an
atomic import workflow:

```ts
inspect(sourceDirectory: string): Promise<CodexPokePetInspection>
adapt(source: CodexPokePetSource, destination: string): Promise<PetManifest>
import(source: CodexPokePetSource): Promise<PetPackage>
```

It validates `pet.json`, requires a safe relative `spritesheetPath`, validates the WebP signature,
exact atlas dimensions and regular-file boundary, creates ID `codex-pokepets-<source-id>`, copies
only the selected local sheet into an `.adapt-*` temporary directory, writes canonical
`manifest.json`, validates the result through `PetRegistry`, atomically renames, rescans, and
selects it. Duplicate IDs are rejected and every failure removes only its own temporary directory.

The generated metadata includes `sourceProject=dnnyngyen/codex-pokepets`, the source pet ID,
`redistributionAllowed=false`, and `locallyImported=true`. Its license text explicitly says the
fan asset is third-party and not covered by this application's MIT license.

## 5. WebP support

Create `src/core/pet/image-metadata.ts` with a bounded signature/dimension reader supporting PNG
and WebP `VP8`, `VP8L`, and `VP8X` headers. The reader checks the real RIFF/WEBP/chunk signature,
non-zero dimensions, regular files, and the existing 20 MiB limit; it never decodes pixels or
uses a native image framework.

Add `PetImageFormat = "png" | "webp"`. Existing animation definitions default to horizontal row
zero and retain the strict `height === frameHeight` rule. Optional `frameRow` and `frames` are used
only for validated multi-row atlases: sheet width and height must divide evenly by frame geometry,
the row must exist, and frame count must fit the row. Preview assets may be PNG or WebP and are
validated by signature rather than extension alone. URLs remain local validated `file:` URLs.

## 6. State overlay effects

Create `PetStateOverlay.tsx` and `pet-state-overlay.css`. The component maps all 12 normalized
states to original CSS/text geometry (`?`, typing dots, speed marks/gear-like ring, `!`, bubble,
stars, error cross, low/empty bars, link break, and `Z`). It is a sibling of the sprite, uses
`pointer-events: none`, stays within the stage, and does not reload the sprite. Reduced-motion CSS
disables overlay and sprite motion while leaving a readable still state marker. Approval/reply
cards remain separate siblings outside the stage.

## 7. Size control

Settings v3 adds:

```ts
interface PetDisplaySettings {
  scalePercent: number; // clamped 50..200, default 100, UI step 5
  lockPhysicalSizeAcrossDisplays: boolean; // default false
}
```

It lives under `preferences.petDisplay`; active pet identity remains Registry-owned. General
Settings adds a slider, percentage output, 50/75/100/125/150/175/200 shortcuts, default restore,
and cross-display lock. `SettingsService` clamps finite scale values and publishes immediately.

## 8. BrowserWindow bounds linkage

Create `src/main/pet-window-layout.ts` with:

```ts
computePetWindowBounds(input: {
  frameWidth: number;
  frameHeight: number;
  scalePercent: number;
  physicalScaleFactor?: number;
  expanded: boolean;
  currentBounds: Rectangle;
  displayWorkArea: Rectangle;
  anchor?: "left-bottom" | "right-bottom" | "free";
}): Rectangle
```

At 100%, frames are normalized to a 192-DIP target height so Pixel Sprout preserves its existing
visual size and 192×208 Codex cells remain comparable. Compact/expanded chrome reserves space for
HUD and cards. Bounds infer left-bottom/right-bottom near work-area edges, otherwise retain center;
all results clamp to the current display. `WindowManager` stores current frame/scale/mode, guards
against identical/re-entrant resizes, updates after pet switch/scale/display changes, and derives a
primary/current scale-factor ratio only when physical-size locking is enabled.

## 9. Dynamic right-click menu

Create `src/main/menu/menu-view-model.ts` and `pet-context-menu.ts`. The pure view model contains
current state/thread count, available pets, checked pet/scale, HUD/top/click-through flags,
approval/input presence, and an optional active turn. `buildPetMenuTemplate(viewModel, actions,
host)` produces native Electron menu templates for either `pet` or `tray`.

The pet menu shows a disabled status header; context actions only when real approval/input/turn
state exists; Pet and Size submenus; Settings routing; HUD/top/click-through; new-thread; and Exit.
The unsupported pause-notification action is omitted. Tray uses the same view model/actions and always
offers click-through recovery, 100% restore, Settings, and Exit.

## 10. Settings schema migration

`settings.v3.json` becomes canonical. `SettingsStore` reads v3 first, then migrates a valid
`settings.v2.json`, then migrates legacy flat `settings.json`. v2 fields are preserved and receive
`petDisplay={scalePercent:100, lockPhysicalSizeAcrossDisplays:false}`. Malformed v3 and numeric
future versions remain protected from writes; missing/invalid older values receive safe defaults.
Load-state reporting distinguishes source version 1 or 2.

## 11. Tests and packaging verification

- Unit-test PNG/WebP signatures, all three WebP headers, dimensions, horizontal/grid geometry,
  traversal, fake WebP, missing files, and duplicate assets.
- Generate original synthetic 8×9 WebP atlases under temporary test directories. A test-only
  Electron canvas script draws simple geometric robots/color blocks; no third-party image fixture
  is committed.
- Test provider discovery, sanitized output, adapter metadata/license, duplicate IDs, success,
  temporary cleanup, multiple packages, and imported-state detection.
- Test v2→v3 migration, defaults, clamping, future protection, preservation, and serialized writes.
- Test 50/100/200%, anchors, free position, display boundaries, pet frame changes, expanded mode,
  and no clipping via the pure layout function.
- Test menu view models/templates for checked pet/size, approval/input, active/inactive turn,
  click-through recovery, and omission of unsupported actions.
- Render overlay markup for all 12 states and inspect CSS for reduced-motion/pointer isolation.
- Extend packaged M3.2 and M3.3 verification with an explicit runtime-generated synthetic Codex
  import while keeping the normal native-picker boundary unchanged.
- Confirm `electron-builder.json` still copies only repository `pets/` (Pixel Sprout), with no
  `.codex/pets`, `userData/pets`, or local import path.

## 12. Commit split

1. `feat: add safe WebP pet assets`
2. `feat: add Codex PokéPets local adapter`
3. `feat: add generic pet state overlays`
4. `feat: add persistent pet size controls`
5. `feat: add dynamic pet context menu`
6. `test: verify adapted pet packages and layout`
7. `docs: document M3.4 local pet integration`

Before every commit run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`,
inspect the diff/status for local assets and secrets, then push the focused commit. The first push
uses `git push -u origin feat/m3-4-pokepets-experience`; later pushes name the same branch without
force options.

## 13. Acceptance criteria

- Existing PNG packages and Pixel Sprout still scan, animate, switch, package, and persist.
- Valid local PNG/WebP assets are signature/dimension/geometry checked; unsafe formats and paths
  are rejected before a `file:` URL reaches a renderer.
- Installed Codex PokéPets can be discovered locally and individually imported only after an
  explicit user action and third-party-rights warning.
- Imported canonical manifests preserve source notice and never call the third-party art MIT.
- No networking exists in discovery/import and no source/user path crosses renderer IPC/logs/docs.
- Every normalized state has a reduced-motion-safe generic overlay independent of the pet art.
- Scale persists and applies live from 50% through 200% through Settings and Ctrl+wheel.
- CSS frame, overlay, shadow, click area, bubbles/cards, BrowserWindow bounds, anchor, and display
  clamping remain synchronized without crop or resize loops.
- Pet and tray native menus share one dynamic view model; tray can always recover interaction.
- Settings v3 migrates v2 without loss and protects future schemas.
- Package/installer inputs contain only Pixel Sprout; userData survives uninstall configuration.
- Format, lint, unit tests, build, `package:dir`, `verify:m3-2`, and Windows `verify:m3-3` are run and
  reported honestly, with automated/packaged/human/not-run evidence separated.

## Task execution checklist

### Task 1: Safe image metadata and atlas manifest

- [x] Add failing manifest/registry tests for WebP signatures and row geometry.
- [x] Implement bounded PNG/WebP metadata parsing and backward-compatible manifest fields.
- [x] Update renderer sprite offsets and verify PNG behavior remains unchanged.
- [x] Run focused tests and the four repository gates; commit/push.

### Task 2: Local provider and adapter

- [x] Add failing synthetic discovery/adapter tests including traversal, duplicate, cleanup, and
      redaction cases.
- [x] Implement provider/types/adapter and atomic managed import.
- [x] Add typed Settings discovery/import IPC and native confirmation/dialog paths.
- [x] Run gates; commit/push.

### Task 3: Generic overlays

- [x] Add markup/CSS contract tests for 12 states, reduced motion, and pointer isolation.
- [x] Implement overlay component/styles and preserve approval/reply layout.
- [x] Run gates; commit/push.

### Task 4: Settings v3 and live layout

- [x] Add failing migration/service/layout/IPC tests.
- [x] Implement v3 store migration/clamping and Settings UI controls.
- [x] Implement pure bounds calculation, window/display synchronization, and renderer scaling.
- [x] Add strict throttled Ctrl+wheel IPC and snapshot refresh.
- [x] Run gates; commit/push.

### Task 5: Shared native menus

- [x] Add failing menu view-model/template tests.
- [x] Implement shared pet/tray menu, dynamic request/turn entries, checked pet/size actions, and
      Settings section navigation.
- [x] Connect right-click to the native menu and preserve tray recovery actions.
- [x] Run gates; commit/push.

### Task 6: Packaged synthetic verification and regression suite

- [x] Add a temporary original geometric WebP generator and packaged adapter fixture path.
- [x] Verify import, switch, restart persistence, preview, and installed-program paths where the
      existing explicit E2E gates permit deterministic automation.
- [x] Run all final gates, safety grep, process cleanup check, and inspect package resources.
- [x] Commit/push focused test changes.

### Task 7: Documentation and evidence report

- [x] Update README, asset policy, architecture, package guide, project plan, import guide, and
      implementation report with explicit evidence categories.
- [x] Record real local import as not run unless a genuine local package becomes available.
- [ ] Run final gates, commit/push, inspect CI, and create only a Draft PR if needed for CI.
