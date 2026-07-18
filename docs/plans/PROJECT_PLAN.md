# Codex Pet Desktop M0/M1 Implementation Plan

> **2026-07-16 product reset:** The remaining milestone order below is superseded by the
> pixel-pet-first baseline. The current source of truth is
> `docs/reports/2026-07-16_PRODUCT_RESET_AUDIT.md` and the first executable plan is
> `docs/superpowers/plans/2026-07-16-pixel-pet-shell.md`. M2.6 no longer gates pet rendering.

> **2026-07-18 M3.1 baseline:** The 2D Pet Asset System is implemented. The current package schema,
> Registry/import boundary, Animation Resolver, and Settings integration are documented in
> `docs/guides/PET_PACKAGE_SYSTEM.md` and
> `docs/superpowers/plans/2026-07-18-m3-1-pet-asset-system.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: use an execution workflow that implements this plan task-by-task, with each task reviewed against its tests before continuing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent, secure Electron desktop pet that completes the M0 desktop shell and an M1 Codex App Server integration loop with deterministic Mock fallback.

**Architecture:** Electron main-process code owns windows, persistence, tray, child processes, and IPC. A framework-independent core translates JSON-RPC protocol messages into normalized pet, approval, session, and usage domain models; the sandboxed React renderer consumes only a narrow preload API and normalized snapshots.

**Tech Stack:** Electron 43, React 19, TypeScript 6, Vite 8, Vitest 4, ESLint 10, Prettier 3, npm 11.

## Global Constraints

- M0/M1 are the baseline; M1.5 and M2 add runtime closure, thread tokens, and user-input replies.
- Windows 10/11 is the primary target; retain low-cost macOS/Linux compatibility.
- Use stable dependencies only and commit `package-lock.json`.
- Keep `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Renderer code never imports Node.js or Electron directly; all system access uses typed preload IPC.
- Do not copy code or assets from Clawd on Desk, AgentPet, Codex PokéPets, Pokémon, or other character projects.
- Do not bundle Pokémon artwork, official sounds, logos, fonts, or game resources.
- Never persist credentials, browser cookies, full conversation logs, full command output, or private file contents.
- Do not add PixiJS, Three.js, Redux, a database, cloud services, telemetry uploads, or automatic releases.
- Do not force-push, rewrite published history, or overwrite an existing remote repository.

---

## File Map

- `src/main/*`: Electron lifecycle, secure windows, tray, settings, App Server ownership, and IPC.
- `src/preload/*`: the only renderer-to-main bridge and its public type declarations.
- `src/renderer/*`: React views for the pet, HUD, approvals, and debug controls.
- `src/core/codex/*`: JSONL framing, JSON-RPC, child-process lifecycle, protocol guards, event normalization, approvals, usage, and mocks.
- `src/core/pet/*`: pet states, priority, per-thread aggregation, package validation/registry,
  external-adapter contract, animation fallback, and transient restoration.
- `src/core/sessions/*`: independent thread snapshots and active-thread counts.
- `src/core/logging/*`: structured, redacted diagnostic records.
- `src/shared/*`: IPC contracts, settings, pet-pack types, and serializable result types.
- `tests/*`: unit and architecture tests that run without Electron UI automation or a real Codex account.
- `pets/example-original-pet/*`: original reproducible PNG Pet Package; no third-party artwork.
- `docs/*`, root policy files, and `.github/workflows/ci.yml`: architecture, implementation evidence, community policy, and CI.

### Task 1: Repository and toolchain baseline

**Files:**

- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`
- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `index.html`
- Create: `AGENTS.md`, `LICENSE`, `CONTRIBUTING.md`, `ASSET_POLICY.md`, `THIRD_PARTY_NOTICES.md`

**Interfaces:**

- Produces scripts: `dev`, `format`, `format:check`, `lint`, `test`, `build`, `preview`.
- Produces output: renderer in `dist/renderer`, Electron bundles in `dist/main` and `dist/preload`.

- [ ] Create the stable package manifest and install the exact declared versions with npm so the lockfile is authoritative.
- [ ] Configure TypeScript as strict, Vite for React renderer output, and separate esbuild calls for main/preload bundles.
- [ ] Configure ESLint to reject renderer imports of `node:*` and `electron`, and Prettier to cover source, tests, JSON, YAML, and Markdown.
- [ ] Add repository, asset, credential, generated-output, local-pet, and log ignore rules.
- [ ] Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`; expect all commands to execute even before feature tests exist.

### Task 2: Domain state, sessions, settings, and logging

**Files:**

- Create: `src/core/pet/pet-state.ts`, `src/core/pet/state-priority.ts`, `src/core/pet/state-machine.ts`
- Create: `src/core/sessions/session-types.ts`, `src/core/sessions/session-registry.ts`
- Create: `src/core/logging/redaction.ts`, `src/core/logging/logger.ts`
- Create: `src/shared/settings.ts`, `src/main/position-store.ts`, `src/shared/pet-manifest.ts`, `src/shared/result.ts`
- Test: `tests/pet-state.test.ts`, `tests/settings.test.ts`, `tests/redaction.test.ts`

**Interfaces:**

- Produces `PetState`, `PetStateChange`, `PetStateMachine`, and `PET_STATE_PRIORITY`.
- Produces `SessionRegistry.update(change)`, `getGlobalState()`, `getActiveCount()`, and transient restore timers.
- Produces `LocalSettingsStore.read()`, `patch()`, and display-bound position clamping.
- Produces `redactValue()` and `SafeLogger` records that contain metadata but not payload bodies.

- [ ] Write failing tests for the exact priority order, independent thread state, global aggregation, transient restoration, persisted defaults, display clamping, and secret/content redaction.
- [ ] Run the focused tests and expect failures caused by missing modules.
- [ ] Implement the minimal typed domain modules and JSON settings adapter needed by those tests.
- [ ] Run the focused tests and expect every assertion to pass without a live Electron process.

### Task 3: JSONL and JSON-RPC core

**Files:**

- Create: `src/core/codex/protocol-types.ts`, `src/core/codex/protocol-guards.ts`
- Create: `src/core/codex/jsonl-buffer.ts`, `src/core/codex/json-rpc-client.ts`, `src/core/codex/mock-transport.ts`
- Test: `tests/jsonl-buffer.test.ts`, `tests/json-rpc-client.test.ts`

**Interfaces:**

- Produces `JsonLineBuffer.push(chunk): string[]` and `flush(): string | null`.
- Produces `JsonRpcClient.sendRequest(method, params, timeoutMs)`, `sendNotification`, `handleIncomingLine`, `onNotification`, `onServerRequest`, `rejectPending`, and `close`.
- Transport contract is `writeLine(line: string): void`; tests use `MockTransport`.

- [ ] Write failing tests for half lines, multiple lines, CRLF, normal/error responses, notifications, server requests, invalid JSON, unknown IDs, timeouts, and pending cleanup.
- [ ] Run `npm test -- tests/jsonl-buffer.test.ts tests/json-rpc-client.test.ts`; expect missing-module failures.
- [ ] Implement defensive parsing and request bookkeeping; invalid input emits a redacted diagnostic and never throws across the process boundary.
- [ ] Re-run the focused tests; expect all protocol cases to pass.

### Task 4: Approval, usage, and event normalization

**Files:**

- Create: `src/core/codex/approval-router.ts`, `src/core/codex/usage-provider.ts`, `src/core/codex/event-normalizer.ts`
- Test: `tests/approval-router.test.ts`, `tests/usage-provider.test.ts`, `tests/event-normalizer.test.ts`

**Interfaces:**

- Produces `ApprovalRequest`, `ApprovalDecision`, `ApprovalRouter.enqueueServerRequest()`, `resolve()`, `respond()`, `getQueue()`, and timeout disposal.
- Produces `RateLimitBucket`, `DailyUsage`, `ThreadTokenUsage`, `normalizeRateLimitBucket`, `sortRateLimitBuckets`, and `formatResetCountdown`.
- Produces `EventNormalizer.normalizeNotification(method, params): DomainEvent[]` without exposing raw JSON-RPC to the renderer.

- [ ] Write failing tests for explicit request/thread/turn/item routing, queue ordering, timeout removal, `serverRequest/resolved`, available decisions, usage clamping/sorting/countdown, known state mappings, token updates, and unknown-event no-op behavior.
- [ ] Run the three focused test files and confirm the failures are caused by absent implementations.
- [ ] Implement protocol guards and conservative field extraction for the locally generated Codex 0.144.1 protocol names.
- [ ] Re-run focused tests; expect approvals and usage to remain deterministic under Mock transport.

### Task 5: Codex App Server process lifecycle

**Files:**

- Create: `src/core/codex/app-server-process.ts`
- Test: `tests/app-server-process.test.ts`

**Interfaces:**

- Produces singleton-owner `AppServerProcess.start()`, `initialize()`, `reconnect()`, `stop()`, status events, and access to its `JsonRpcClient`.
- Launch command is `codex app-server --listen stdio://`, verified locally against Codex CLI 0.144.1.
- Initialization sends `initialize` with client metadata and then `initialized`; failures surface as status and activate Mock fallback, never as fabricated real data.

- [ ] Write failing tests using an injected spawn adapter for one-child enforcement, stdout chunk framing, separate stderr handling, initialization sequence, abnormal exit cleanup, bounded exponential backoff, and graceful stop.
- [ ] Run `npm test -- tests/app-server-process.test.ts`; expect missing-module failures.
- [ ] Implement lifecycle ownership without logging environment variables, stdin payloads, full stderr bodies, or response bodies.
- [ ] Re-run the focused tests; expect all process behavior to pass with fakes.

### Task 6: Electron main, preload, IPC, and windows

**Files:**

- Create: `src/main/index.ts`, `src/main/window-manager.ts`, `src/main/tray-manager.ts`, `src/main/ipc-handlers.ts`
- Create: `src/preload/index.ts`, `src/preload/api-types.ts`, `src/shared/ipc-contract.ts`
- Test: `tests/renderer-boundary.test.ts`, `tests/ipc-contract.test.ts`

**Interfaces:**

- Preload exposes only `getSnapshot`, `subscribe`, `setPetState`, `respondApproval`, `toggleHud`, `toggleDebug`, `toggleAlwaysOnTop`, `toggleClickThrough`, `reconnectCodex`, `patchSettings`, and `quit`.
- Main creates a frameless transparent skip-taskbar pet window, a settings/HUD window, saves/clamps position, and updates click-through with `setIgnoreMouseEvents`.
- Tray provides show/hide, HUD, debug, always-on-top, click-through, reconnect, about, and quit actions.

- [ ] Write architecture tests that scan renderer imports and fail on `electron`, `node:*`, `require`, `process`, and direct filesystem access.
- [ ] Implement strict IPC channel allowlists and serializable snapshot types.
- [ ] Implement secure BrowserWindow preferences, position persistence, tray behavior, single-instance lock, and App Server cleanup on quit.
- [ ] Run the architecture tests and the full type-aware lint/build gates.

### Task 7: React pet, HUD, approval card, and debug controls

**Files:**

- Create: `src/renderer/main.tsx`, `src/renderer/app/App.tsx`, `src/renderer/app/use-desktop-api.ts`
- Create: `src/renderer/pet/Pet.tsx`, `src/renderer/hud/Hud.tsx`, `src/renderer/approval/ApprovalCard.tsx`, `src/renderer/debug/DebugPanel.tsx`
- Create: `src/renderer/styles/base.css`, `src/renderer/styles/pet.css`, `src/renderer/env.d.ts`
- Test: `tests/approval-view-model.test.ts`, `tests/hud-view-model.test.ts`

**Interfaces:**

- Renderer consumes `DesktopSnapshot` only and never raw protocol messages.
- Approval buttons render only `availableDecisions`; long commands are collapsed behind `<details>`, paths and network targets have separate summaries.
- HUD displays connection, pet state, active threads, cwd/project, dynamic rate buckets, countdown, daily tokens, and current-thread tokens; unavailable real data is labeled unavailable.

- [ ] Write failing pure view-model tests for decision labels, command collapse, path/network summaries, empty usage labels, and dynamic bucket ordering.
- [ ] Implement the original CSS pet with breathing/float animation, drag region, interactive controls, approval queue, compact HUD, and all-state debug switcher.
- [ ] Run view-model tests, then `npm run lint` and `npm run build`; expect no renderer Node access or unsafe HTML injection.

### Task 8: Documentation, CI, evidence, and original theme

**Files:**

- Create: `README.md`, `docs/architecture/ARCHITECTURE.md`, `docs/reports/M0_M1_IMPLEMENTATION.md`
- Create: `themes/example-original-pet/manifest.json`, `themes/example-original-pet/README.md`, `user-pets/.gitkeep` (ignored and not committed)
- Create: `.github/workflows/ci.yml`

**Interfaces:**

- CI runs Node 24 LTS with `npm ci`, formatting, lint, tests, and build.
- Report distinguishes real Codex process/protocol evidence from fake-process and Mock UI evidence.

- [ ] Document early-development status, current M0/M1 features, M2-M6 roadmap, setup/build commands, App Server requirement, privacy, asset policy, MIT license, inspiration, screenshot placeholder, and independent-project disclaimer.
- [ ] Record exact dependency versions, local Codex CLI behavior, implemented protocol names, real-vs-Mock status, test count, manual launch result, known issues, and security scan outcome.
- [ ] Add a CSS-only original pet manifest and keep `user-pets/` ignored.
- [ ] Add CI without packaging, publishing, releases, or telemetry.

### Task 9: Verification, commit, and publish

**Files:**

- Modify: `docs/reports/M0_M1_IMPLEMENTATION.md` with final measured results.

**Interfaces:**

- Produces one focused initial commit titled `feat: bootstrap Codex desktop pet` and, if safe, a public GitHub repository owned by the authenticated user.

- [ ] Run in order: `npm run format`, `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`; record exact pass counts.
- [ ] Start `npm run dev` with a bounded validation window, capture process/window evidence, and terminate it cleanly so no Electron or App Server process remains.
- [ ] Inspect `git diff --check`, `git diff --stat`, tracked paths, and repository content for credentials, cookies, auth headers, `.env`, private home paths, conversation logs, Pokémon images, and third-party sounds.
- [ ] Update the report with measured evidence and repeat all quality gates after the documentation change.
- [ ] Verify repository-local Git identity, stage all intended files, run `git diff --cached --check`, and commit with the required title.
- [ ] Inspect any same-name GitHub repository before creating or connecting it; never overwrite non-empty unrelated history.
- [ ] Push `main`, then compare the full local 40-character SHA with `git ls-remote origin HEAD` and require a clean worktree.

## Milestones

- **M0 — Project and desktop shell:** this plan's Tasks 1, 2, 6, 7, and M0 documentation.
- **M1 — App Server technical loop:** this plan's Tasks 3-5, approvals/usage UI, protocol evidence, Mock fallback, and tests.
- **M1.5 — Runtime closure and real-verification guides:** RuntimeController, request registry,
  thread-aware token snapshots, CI repair, and explicit manual approval evidence.
- **M2 — User input and replies:** normalized request routing, strict IPC, typed reply cards, and
  mock verification; human real-App-Server confirmation remains a manual guide.
- **M2.5 — Codex conversation control:** explicit `thread/start`, `turn/start`, `turn/steer`, and
  `turn/interrupt` controllers; debug-only safe developer controls; selected-thread cwd; lifecycle
  cleanup; and separate protocol/mock/human verification records. M3 HUD and M4 pet packs follow
  only after guided real desktop approval and input checks are recorded.
- **M3 — Complete quota and Token HUD:** future; M1 supplies only provider/UI foundations.
- **M4 – Pet packs and animation system:** delivered as M3.1 with safe local discovery, import,
  switching, PNG sprite geometry, animation fallback, Settings UI, and an original package.
- **M5 — Multiple sessions and productization:** future; M1 tracks independent thread state only.
- **M6 — Installers, updates, and releases:** future; no packaging or release automation in this change.

## M2.6 extension

- Native realpath cwd boundaries and renderer-safe cwd selections.
- Five-kind in-memory verification state and unified request cleanup.
- Guided human Allow, Deny, User Input, Steer, and Interrupt checks.
- M2.6 remains a development verification track and does not gate the pixel pet product shell.

## Product-first milestone order (current)

- **P1 — Pixel pet shell:** compact/expanded window, original raster sprite theme, state animation
  fallback, and sketch-shaped two-row quota HUD.
- **P2 — Real Codex observation:** official lifecycle hook installer, local event bridge, session
  aggregation, hook health, and App Server as an optional control path rather than the only sensor.
- **P3 — Human action surfaces:** approval and user-input cards opened progressively from the pet.
- **P4 – User pet packs:** complete in M3.1 with safe local package discovery, validation, preview,
  attribution/license display, import, switching, rescan, and failure isolation.
- **P5 — Productization:** click hit-window hardening, settings, startup behavior, installers, and
  releases.

## Self-Review

- Spec coverage: every M0/M1 acceptance item maps to Tasks 1-9; future milestone behavior is explicitly not claimed.
- Placeholder scan: tasks use concrete files, interfaces, commands, and expected outcomes; no implementation placeholder delegates unspecified behavior.
- Type consistency: renderer consumes `DesktopSnapshot`; protocol is normalized to domain events; approval and usage contracts are shared end-to-end.
