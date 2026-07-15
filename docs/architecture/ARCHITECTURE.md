# Architecture

## Boundaries

Codex Pet Desktop has four deliberate boundaries:

1. `src/main/index.ts` owns Electron lifecycle, windows, tray composition, and IPC composition;
   `src/main/runtime-controller.ts` owns App Server lifecycle, snapshots, normalized state,
   request queues, usage refresh, and runtime cleanup.
2. `src/preload` exposes a frozen, typed API over a fixed channel allowlist.
3. `src/core` implements protocol and domain logic without React or Electron UI dependencies.
4. `src/renderer` is a sandboxed React client that consumes `DesktopSnapshot`; it never receives
   raw JSON-RPC messages and never imports Node.js or Electron.

The pet renderer is independent from state calculation. Each thread has a `PetStateChange`; the
state machine selects the highest-priority active state for the global pet. Success and error are
transient overlays that restore the prior stable state.

## Codex App Server flow

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

`ThreadController` owns developer-created thread metadata, selection, and cwd validation. It accepts
only absolute paths in the repository root or Git-ignored `tmp/e2e/` subtree, and creates ephemeral
threads with fixed `untrusted` approval policy, `workspace-write` sandbox mode, and `user` approval
reviewer. It never accepts renderer-selected sandbox or approval settings.

`TurnController` owns `turn/start`, `turn/steer`, and `turn/interrupt` parameters. Steer requires
the supplied `expectedTurnId` to match the active turn; interrupt requires the active thread/turn
pair. The renderer has only seven typed control actions: create, start, steer, interrupt, select,
approval test, and user-input test; it cannot make arbitrary JSON-RPC calls.

Developer controls render only while `debugVisible` is true. Fixed test prompts prohibit network,
Git, credentials, installation, and source changes. In-memory E2E records hold only short hashes of
request IDs and never command, answer, prompt, or path bodies.

## Security and storage

Browser windows use `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
Renderer access is limited to the preload contract. Local settings contain presentation choices
and window position only; they do not store credentials. Diagnostic metadata passes through
recursive redaction before reaching the logger.

The repository excludes build products, logs, environment files, local themes, and user pet
assets. There is no browser scraping, cookie access, cloud database, account emulation, or
telemetry upload.
