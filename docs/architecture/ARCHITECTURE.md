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

## Pixel theme and window layout

The renderer consumes a trusted `RuntimePetTheme`; it does not resolve arbitrary filesystem paths.
The bundled original SVG is a `4 x 4` sheet of `64 x 64` frames rendered with nearest-neighbor
scaling. State fallback traversal is cycle-bounded and always resolves to `idle`.

The normal window is `300 x 360`. Opening details, debug tools, an approval, or a structured input
resizes it to `420 x 700`. Resizing preserves the lower-right edge and clamps the result to the
nearest display work area.

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

## Security and storage

Browser windows use `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
Renderer access is limited to the preload contract. Local settings contain presentation choices
and window position only; they do not store credentials. Diagnostic metadata passes through
recursive redaction before reaching the logger.

The repository excludes build products, logs, environment files, local themes, and user pet
assets. There is no browser scraping, cookie access, cloud database, account emulation, or
telemetry upload.
