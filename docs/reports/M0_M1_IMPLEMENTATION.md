# M0/M1 implementation report

## Scope and environment

This report covers only M0 (project and desktop shell) and M1 (Codex App Server technical loop).
M2-M6 remain planned work.

- Platform: Windows 11-compatible environment
- Node.js: 24.15.0
- npm: 11.14.1
- Codex CLI used by the real handshake: 0.144.4 npm installation
- Electron: 43.1.1
- React / React DOM: 19.2.7
- TypeScript: 6.0.3
- Vite / React plugin: 8.1.4 / 6.0.3
- Vitest: 4.1.10
- ESLint / typescript-eslint: 10.7.0 / 8.64.0
- Prettier: 3.9.5
- esbuild: 0.28.1

The npm registry reported TypeScript 7.0.2 as newer, but typescript-eslint 8.64.0 declares support
for TypeScript `>=4.8.4 <6.1.0`; TypeScript 6.0.3 is therefore the current mutually compatible
stable choice for this toolchain.

The interactive Codex desktop command also reported 0.144.1, but its PowerShell profile wrapper
points at a separate home and executable surface. M1 therefore records the actual child-process
handshake user agent and generated protocol from the npm CLI used by the app.

## Implemented structure

- `src/main`: application lifecycle, window, tray, IPC, and settings persistence.
- `src/preload`: typed, allowlisted renderer bridge.
- `src/renderer`: original pet, HUD, approval card, and all-state debug controls.
- `src/core/codex`: App Server process, JSONL/JSON-RPC, protocol guards, event normalization,
  approval routing, usage providers, and Mock transport.
- `src/core/pet` and `src/core/sessions`: per-thread state and session snapshots.
- `src/core/logging`: structured diagnostics and recursive redaction.
- `tests`: protocol, lifecycle, state, routing, usage, settings, view-model, and boundary tests.

## App Server protocol

The launch semantics are `codex app-server --listen stdio://`. On Windows the implementation uses
a fixed `cmd.exe /d /s /c` wrapper around the trusted local npm command shim to avoid Node.js
`spawn EPERM` for `.cmd` files. Electron's Node runtime also requires Windows verbatim argument
passing so quoted shim paths are not escaped twice. An explicit trusted path can be supplied
through `CODEX_PET_CODEX_PATH`.

Initialization sends `initialize` with client metadata and capabilities, waits for the response,
then sends `initialized`. The live 0.144.4 handshake succeeded.

Normalized notifications include:

- `error`
- `thread/started`, `thread/status/changed`, `thread/closed`, and `thread/deleted`
- `turn/started` and `turn/completed`
- `item/started` and `item/completed`
- `thread/tokenUsage/updated`
- `account/rateLimits/updated`
- `serverRequest/resolved`

Server requests implemented for the M1 approval loop:

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`
- `item/permissions/requestApproval`

`item/tool/requestUserInput` is recognized as `waiting_input`, but returning user answers is an M2
feature and is not claimed as complete.

## Real versus Mock verification

Real Codex verification:

- `codex app-server --help` confirmed `stdio://` support.
- The npm Codex CLI 0.144.4 returned a valid `initialize` response.
- `account/rateLimits/read` succeeded with one dynamic limit group.
- `account/usage/read` succeeded with seven daily buckets.
- A real `npm run dev` Electron smoke launch reached the connected App Server state through the
  production `AppServerProcess` path, then exited gracefully with no remaining project process.
- No real approval was intentionally triggered, so human approval response behavior is not
  claimed as manually verified.

Mock and fake-process verification:

- Fragmented/multi-line stdout, initialization, notifications, stderr isolation, process exit,
  pending-request cleanup, graceful stop, and bounded exponential reconnects use fake processes.
- Approval queueing, response routing, timeout cleanup, and UI decision filtering use deterministic
  tests and Mock data.
- The debug panel can enqueue a clearly labeled Mock approval and switch through every pet state.

## Usage behavior

Rate-limit labels are derived from `windowDurationMins`; no five-hour or weekly name is hard-coded.
Remaining percent is clamped from `100 - usedPercent`, and reset timestamps are rendered as
non-negative countdowns. Failed or unavailable account requests produce `null` data and the HUD
displays “Data unavailable.” Mock values are opt-in and labeled.

## Verification results

Final measured values after the complete quality and desktop launch pass:

- Format: `npm run format` and `npm run format:check` passed.
- Lint: `npm run lint` passed with no findings.
- Tests: 12 test files passed, containing 35 passing tests.
- Build: TypeScript checking, Vite renderer build, and esbuild main/preload bundles passed.
- Manual launch: `npm run dev` launched the real Electron application. A bounded smoke mode verified
  a visible, frameless, transparent-configured, always-on-top window; a live tray; the HUD; debug
  panel; Mock approval card; all 11 state buttons; and the CSS drag region. The captured window was
  visually inspected, graceful quit was requested through Electron, and zero project Electron
  processes remained afterward. A second privacy-preserving launch used real Codex data without a
  screenshot and verified the renderer's connected state.

## Security and privacy review

- Renderer architecture tests reject direct Electron, Node.js, filesystem, `require`, and `process`
  access.
- Browser window security uses context isolation, disabled Node integration, and sandboxing.
- Settings contain no tokens, browser cookies, or session data.
- Logs redact credential fields, bearer-like values, user messages, command output, and file
  contents.
- The real usage probe printed only endpoint status and bucket counts, not account values.
- No Pokémon or third-party character art, sounds, logos, fonts, or copied source files are present.

## Known issues and next step

- Real command/file/permission approvals still need a controlled human end-to-end reproduction;
  M1 currently proves their protocol shape, routing, response construction, and UI with generated
  local types plus Mock/fake-process tests.
- Installer packaging, auto-update, richer pet packs, multi-session product UI, and user-input
  replies are outside this milestone.

Recommended next milestone: M2 user-input requests and reply windows, while retaining the same
request/thread/turn routing guarantees.

## GitHub publication

The public repository was created at
`https://github.com/zxy19960316/codex-pet-desktop`. The initial implementation commit
`0cab5b17d5a90874592fff9ce5ecbff2b5c9e4ef` (`feat: bootstrap Codex desktop pet`) was pushed to
`origin/main`, and `git ls-remote origin HEAD` returned the same full SHA.
