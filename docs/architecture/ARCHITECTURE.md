# Architecture

## Boundaries

Codex Pet Desktop has four deliberate boundaries:

1. `src/main/index.ts` owns Electron lifecycle, windows, tray composition, and IPC composition;
   `src/main/runtime-controller.ts` combines normalized Hook and optional App Server events, while
   SnapshotAssembler and E2EVerificationStore own renderer-safe snapshots and redacted
   verification state.
2. `src/preload` exposes a frozen, typed API over a fixed channel allowlist.
3. `src/core` implements protocol and domain logic without React or Electron UI dependencies.
4. `src/renderer` is a sandboxed React client that consumes `DesktopSnapshot`; it never receives
   raw JSON-RPC messages and never imports Node.js or Electron.

The pet renderer is independent from state calculation. Each thread has a `PetStateChange`; the
state machine selects the highest-priority active state for the global pet. Terminal success and
error are transient overlays with an explicit idle return target, so completed work cannot revert
to stale `working` state.

## Codex lifecycle Hook flow

Official lifecycle hooks are the primary observation path for Codex sessions that already exist in
the desktop app or CLI. The tray's explicit connection action merges handlers into
`~/.codex/hooks.json`; it preserves unrelated entries and leaves Codex's mandatory trust review in
place. The small receiver discards every input field except session ID, turn ID, hook event name,
and timestamp, then appends a bounded local event record. `HookEventBridge` tails new records and
maps them into the same `PetStateChange` domain model as other sources.

The bridge never reads the transcript and cannot approve or modify a Codex turn. Bidirectional
actions remain an optional App Server responsibility.

## Codex App Server flow

App Server is an optional action/control path and is disabled by default. When enabled,
`AppServerProcess` owns exactly one child process per application instance. Windows uses the local
npm `codex.cmd` through a fixed `cmd.exe` wrapper; other platforms invoke `codex` directly. The
Electron enables Windows verbatim argument passing for that wrapper so command-shim quotes are not
escaped a second time. The transport is newline-delimited JSON. `JsonLineBuffer` handles partial
and multiple lines, while `JsonRpcClient` owns request IDs, pending promises, timeouts,
notifications, and server requests.

After `initialize` succeeds, the client sends `initialized`, registers the locally supported
notification and approval methods, and reads usage data. Abnormal exits reject every pending
request and trigger a finite exponential reconnect sequence. Application shutdown waits for the
usage provider and child process to stop before Electron quits.

`EventNormalizer` converts protocol notifications into domain events. Unknown methods create only
a payload-free diagnostic code and never alter pet state.

## Pet packages, animation, and window layout

Pet resources and UI themes are separate. `PetRegistry` scans reviewed packages under the
application `pets/` directory plus imported packages under Electron user data. It validates the
manifest, safe relative paths, regular-file boundary, PNG/WebP signatures and dimensions, sprite frame
geometry, import count/size limits, duplicate IDs, and the mandatory `idle` animation. One broken
package creates a renderer-safe issue record and does not abort the scan or application startup.

The Registry caches only valid `PetPackage` objects and owns the current ID. Selection is persisted
in a small `.active-pet.json` file beside user packages rather than adding character identity to UI
theme or Settings preference schemas. Outgoing desktop and Settings snapshots are decorated in
`src/main/index.ts`; `RuntimeController` remains concerned only with normalized activity state.

`AnimationResolver` maps the 12-state M3.1 vocabulary to a concrete `PetAnimationAsset`. A
manifest fallback takes precedence over deterministic defaults such as
`working -> thinking -> idle`; cycles are bounded and a damaged in-memory package returns no
animation rather than throwing. The renderer uses validated URLs and geometry only and never
resolves arbitrary filesystem paths. Horizontal PNG sheets stay compatible; validated WebP and
optional explicit row/frame geometry support static multi-row atlases. Duration remains derived
from frames and FPS.

At 100%, the pet is normalized to a 192-DIP visual height. `computePetWindowBounds` links current
frame geometry, 50–200% scale, compact/expanded chrome, display work area, and left-bottom,
right-bottom, or free-position anchoring. `WindowManager` applies only changed bounds, clamps to
the current display, and optionally compensates for display scale-factor changes.

`ServerRequestRegistry` installs the three approval methods and
`item/tool/requestUserInput` on each connected client. It retains only pending request resolvers
and redacted approval metadata. `InputRouter` owns explicit request/thread/turn/item binding,
timeouts, cancellation, and answer validation; the renderer receives a serializable normalized
request and has no general JSON-RPC IPC channel.

## Approval safety

Approval cards are keyed by the App Server request ID and retain explicit thread, turn, and item
IDs. Routing never guesses from the currently visible thread. Multiple requests queue in arrival
order; server resolution and timeouts remove only the matching request. The renderer displays only
known decisions offered by the server and cannot widen permission scope through free-form IPC.

For permission approvals, the response matches the installed protocol's
`{ permissions, scope }` shape. Deny and cancel return an empty granted-permission profile. Null or
unknown capabilities are never promoted into grants.

Thread token notifications are normalized into a `Map<string, ThreadTokenUsage>`. The renderer
receives an array plus an optional selected thread ID, while `currentThreadTokens` is derived from
that selected thread or the last active thread. Token payloads are never sent to diagnostics.

## Thread and turn control

`ThreadController` owns developer-created thread metadata, selection, and cwd validation.
SafePathResolver resolves opaque project-root, e2e-root, or project-relative selections in the
main process. It checks native realpaths and every existing path component, rejects traversal,
NUL, absolute renderer paths, symlinks, junctions, and reparse escapes, and rechecks newly created
directories. Test threads are forced into a unique Git-ignored `tmp/e2e` child.

`TurnController` owns `turn/start`, `turn/steer`, and `turn/interrupt` parameters. Steer requires
the supplied `expectedTurnId` to match the active turn; interrupt requires the active thread/turn
pair. The renderer has only seven typed control actions: create, start, steer, interrupt, select,
approval test, and user-input test; it cannot make arbitrary JSON-RPC calls.

Developer controls render only while `debugVisible` is true. Fixed test prompts prohibit network,
Git, credentials, installation, and source changes. The renderer receives cwd labels rather than
internal absolute cwd values. In-memory E2E records cover five verification kinds and hold only
short hashes plus allowlisted protocol event names.

All stopped, error, reconnecting, mock-mode, and shutdown paths call one transport-unavailable
cleanup operation. It settles server requests, clears sending flags and transient thread state,
and fails any running verification without persisting raw protocol bodies.

## M3.0 Settings Center

The Settings Center is a second, normal framed `BrowserWindow`, separate from the transparent pet
window. `SettingsWindowManager` owns its single-instance lifecycle: repeated opens show and focus
the existing window, while a close clears the retained reference. Vite builds `settings.html` as a
separate renderer entry, and Electron loads a dedicated `settings.cjs` preload. The window keeps
`contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.

The settings preload exposes snapshot read/subscription, typed settings patching, and four narrow
pet-management actions: select, import through a native folder picker, rescan, and open the managed
user pet directory. It does not expose debug pet-state controls, approval or input replies, Codex
turn controls, M2.6 verification actions, Node.js, Electron, general paths, or general filesystem
access. Every Settings IPC invocation compares the sender's `webContents.id` with the live Settings
Window before doing work. Patch parsing in the main process accepts only these exact fields:

- future-syncable preferences: `alwaysOnTop`, `clickThrough`, `soundEnabled`, and
  `quotaWarningPercent`;
- device-local connection controls: `useMockData` and `autoStartAppServer`.

Unknown partitions, unknown nested fields, non-boolean switches, non-finite quota values, and quota
values outside `0..100` are rejected before they reach the runtime. Pet selection accepts only a
canonical package ID; the native picker path never comes from renderer input. The Settings renderer
displays seven sections: Status, General, Pets, Codex connection, Quota, Diagnostics, and About.

Settings changes continue through the existing `RuntimeController.patchSettings()` seam. Its
existing persistence callback writes through `SettingsService`; its existing settings-changed
callback applies always-on-top and click-through to the pet window and rebuilds the tray; its
existing snapshot publication updates both renderers. A quota-warning patch therefore reaches the
pet snapshot immediately without adding Settings Window, theme, menu, or scaling responsibilities
to `RuntimeController`. `WindowManager` now depends on the service's narrow `patch()` interface so
pet-position writes use the same serialized v3 store instead of a second legacy writer.

### Versioned settings and migration

The canonical file is `settings.v3.json` with `schemaVersion: 3`. The document separates
future-syncable `preferences` from device-local `device` fields:

| Legacy flat field                                                    | v3 destination |
| -------------------------------------------------------------------- | -------------- |
| `alwaysOnTop`, `clickThrough`, `soundEnabled`, `quotaWarningPercent` | `preferences`  |
| `layoutVersion`, `petPosition`, `hudVisible`, `debugVisible`         | `device`       |
| `useMockData`, `autoStartAppServer`                                  | `device`       |

On startup, a valid v3 file is authoritative. If absent, `MigrationRegistry` migrates a valid v2
file and adds `preferences.petDisplay` defaults (`100`, `false`); otherwise it reads the legacy flat
file. Known valid fields are preserved and v3 is written once. Sources are preserved. The prior compact-layout behavior is
also preserved: a legacy file without the current `layoutVersion` resets `hudVisible` and
`debugVisible` to `false`.

`SettingsStore` writes a complete, newline-terminated temporary file in the destination directory
with mode `0o600`, then atomically renames it over the v3 path. Writes are serialized by
`SettingsService`, preventing concurrent pet-position and UI patches from losing fields. A failed
rename leaves the previous canonical file intact and triggers best-effort cleanup of only the
temporary file.

Malformed JSON or a structurally invalid v3 document starts with safe defaults and a protected
diagnostic state; the original file is not deleted or automatically overwritten. A numeric
`schemaVersion` greater than `3` is treated as a protected future version and is likewise never
overwritten. Explicit changes can still apply in memory for the current process so the pet remains
usable, but persistence stays disabled until the protected file is repaired or upgraded by a
compatible release.

### M3.1 Pet manager and import boundary

`PetSelector` displays the active preview, author, version, license, origin, package status, and
isolated validation issues. Switching and rescanning update both renderer snapshots without
restarting or changing Codex transport. Import validates the user-selected source tree, copies it
to a temporary directory under user-data `pets/`, validates the copy, and atomically renames it.
Duplicates and invalid sources never replace installed packages, and failed temporary copies are
removed.

`ExternalPetAdapter<TSource>` remains a format-neutral conversion seam. It grants no download or
validation bypass and does not bind the application to Clawd, Pokémon-like packs, or another
project. M3.1 does not implement cloud synchronization, mobile clients, an online marketplace,
automatic updates or release automation.

### M3.4 local adapter, presentation, and native-menu boundary

`CodexPokePetsProvider` discovers only local immediate children and returns sanitized source
labels. `CodexPokePetsAdapter` validates the fixed WebP atlas and copies one explicitly chosen
source into managed user data through a temporary directory. Its manifest preserves third-party
source and non-redistribution metadata and never claims the asset is MIT. No download or upload is
introduced.

The renderer keeps sprite and `PetStateOverlay` separate; all 12 states have original CSS/text
markers with `pointer-events: none` and reduced-motion handling. Ctrl+wheel emits only a bounded
integer step over `adjustPetScale`; the main process applies five-percent changes through the
existing settings service.

`buildPetMenuViewModel` is shared by the desktop context menu and tray. It owns checked pet/scale,
current status, request/active-turn presence, and interaction flags. The native menu exposes only
implemented actions. Tray always retains click-through recovery, default size, Settings, and Exit.

### M3.2 packaged resource and verification boundary

Development resolves built-in packages from `<appPath>/pets`. Packaged processes resolve them from
`<process.resourcesPath>/pets`, where the unpacked application places the reviewed package tree
beside `app.asar`. User imports continue to live only under Electron user-data and are never mixed
with installation resources.

The M3.2 verifier is enabled only by the explicit `--m3-2-e2e` process argument. It keeps path
injection and Chromium screenshot capture in the main process, drives stable DOM controls through
the real sandboxed Settings window, and runs two packaged processes against one isolated user-data
directory. This proves packaged discovery, IPC, import, switching, restart persistence, rescan,
and preview rendering without changing normal native-picker behavior or the renderer security
boundary.

### M3.3 installer and signing boundary

`electron-builder.json` consumes only the compiled `dist/` tree and root package metadata for
`app.asar`, then copies reviewed `pets/` into `resources/pets`. The NSIS target is x64, assisted,
per-user, and permits choosing an install directory. Automatic verification disables desktop and
start-menu shortcuts and installs only to an exact verifier-owned directory below `os.tmpdir()`.

The application icon is a deterministic nearest-neighbor derivative of the committed original
Pixel Sprout preview. Generated PNG/ICO files and distribution artifacts stay ignored. Unsigned
builds produce an explicit `NotSigned` report; signed builds require `WIN_CSC_LINK` and
`WIN_CSC_KEY_PASSWORD` before enabling `forceCodeSigning`. Secrets never cross into renderer IPC,
repository configuration, or verification output.

The lifecycle verifier does not remove the installation directory itself. It launches the NSIS
uninstaller and passes only if that directory disappears, then deletes its separate temporary
user-data and import fixture. The manual GitHub Actions workflow has read-only repository
permission and uploads artifacts without publishing releases.

## Security and storage

Browser windows use `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
Renderer access is limited to its window-specific preload contract. Local settings contain
presentation choices, local connection toggles, and window position only; they do not store
credentials. Diagnostic metadata passes through recursive redaction before reaching the logger.

The repository excludes build products, logs, environment files, local themes, and user pet
assets. There is no browser scraping, cookie access, cloud database, account emulation, or
telemetry upload.
