# M4.1 Session Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a privacy-safe, multi-source Codex session model that supplies stable desktop snapshots and native-menu summaries without changing pet packages, installer behavior, or release metadata.

**Architecture:** `src/core/sessions` will be a pure domain layer: adapters convert App Server, Hook, and JSONL metadata into `SessionObservation`; `SessionRegistry` owns deterministic lifecycle, timing, and bounded snapshots; `AttentionArbiter` chooses the global pet input. Main-process services observe files and persist only the daily active-time aggregate. Renderer IPC receives only sanitized summaries.

**Tech Stack:** Electron 43, TypeScript 6, React 19, Vitest 4, Node.js filesystem APIs.

## Global Constraints

- Base all commits on `8e6b4d48b8fdb756289acda259330099dbcc3b4f` on `feat/m4-1-session-intelligence`.
- Preserve uncommitted user changes; never use reset, force-push, auto-merge, release/tag edits, installer/signing changes, pet manifest changes, or third-party assets.
- Never read or persist prompts, conversation body, commands, tool input/output, raw cwd, or JSONL paths.
- Use the existing App Server, Hook bridge, and session monitor; do not add a fourth observer.
- Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build` before each focused commit; run `npm run package:dir` before final handoff.

## File Structure

- `src/core/sessions/session-types.ts`: neutral records, observations, sanitized snapshot types, and bounded constants.
- `src/core/sessions/session-title.ts`: title sanitization and privacy-mode resolver.
- `src/core/sessions/session-clock.ts`: injected-clock elapsed and capped active-work calculations plus interval union helpers.
- `src/core/sessions/session-registry.ts`: ordered, merge-safe lifecycle store and pruning.
- `src/core/sessions/attention-arbiter.ts`: pure primary-session and presentation decision.
- `src/core/sessions/codex-session-observation.ts`: App Server, Hook, monitor, approval, and input adapters.
- `src/main/session-activity-store.ts`: atomic, throttled daily aggregate only.
- `src/main/codex-session-monitor.ts`: bounded multi-file safe telemetry/activity reader.
- `src/main/runtime-controller.ts`, `src/main/snapshot-assembler.ts`, `src/shared/ipc-contract.ts`: compose and expose session overview safely.
- `src/main/menu/menu-view-model.ts`, `src/main/menu/pet-context-menu.ts`, `src/main/tray-manager.ts`: shared native menu summary/actions.
- `tests/session-*.test.ts`, `tests/attention-arbiter.test.ts`, `tests/codex-sessions-monitor.test.ts`: lifecycle, privacy, timing, storage, and menu regression coverage.

---

### Task 1: Establish neutral session types, title safety, and Registry lifecycle

**Files:**

- Create: `src/core/sessions/session-types.ts`, `src/core/sessions/session-title.ts`, `src/core/sessions/session-registry.ts`, `src/core/sessions/index.ts`
- Test: `tests/session-title.test.ts`, `tests/session-registry.test.ts`

- [ ] Write failing tests for three concurrent IDs, stale-observation rejection, closed-terminal handling, completed-then-new-turn revival, deterministic sorting, retention pruning, malformed input isolation, 20-summary cap, title privacy modes, control/newline removal, path basenames, 36/28-character caps, and stable anonymous fallbacks.
- [ ] Implement exact `AgentSessionState`, `SessionObservationSource`, `AgentSessionRecord`, `SessionObservation`, and `SessionRegistrySnapshot` types. Validate strings/timestamps at the entry point; clone all public records; cap public strings and never store raw unsafe titles.
- [ ] Implement `resolveSessionTitle({ title, projectLabel, privacy, fallbackNumber })`, using safe title, then safe project label, then `Codex Session N`; `project-only` ignores title and `anonymous` always uses fallback.
- [ ] Implement `SessionRegistry.observe`, `getSession`, `getSnapshot`, `closeSession`, `prune`, and `reset`. Use last accepted timestamps per field, source set union, terminal/revival rules, attention flags, source-specific capability precedence, bounded records, and stable sort: attention, active state, newest activity, session ID.
- [ ] Run `npm test -- tests/session-title.test.ts tests/session-registry.test.ts` and commit `feat: add agent session registry`.

### Task 2: Add timing, interval-union activity accounting, and arbitration

**Files:**

- Create: `src/core/sessions/session-clock.ts`, `src/core/sessions/attention-arbiter.ts`
- Modify: `src/core/sessions/session-registry.ts`
- Test: `tests/session-clock.test.ts`, `tests/attention-arbiter.test.ts`

- [ ] Write failing fake-clock tests for session/turn elapsed values, active-state accounting, duplicate timestamp no-op, backward clock clamp, 90-second observation cap, terminal pause, new-turn continuation, eight-hour/20-session bounded run, and two-session interval union.
- [ ] Implement pure clock helpers that return non-negative finite millisecond values; only `thinking`, `working`, `approval`, and `waiting_input` consume capped active intervals. Keep each session independent and merge concurrent intervals only for daily total.
- [ ] Write failing arbiter tests for `waiting_input > approval > error > active multi-session > working > thinking > transient success > idle > offline`, newest tie break, four-secondary cap, and success not masking concurrent work.
- [ ] Implement pure `arbitrateSessionAttention(snapshot)` with typed counts, primary state, concurrency level, limited secondaries, and presentation hint.
- [ ] Run the focused suites and commit `feat: add session timing and attention arbitration`.

### Task 3: Adapt existing Codex sources and provide bounded daily persistence

**Files:**

- Create: `src/core/sessions/codex-session-observation.ts`, `src/main/session-activity-store.ts`
- Modify: `src/core/codex/hook-event.ts`, `src/main/hook-event-bridge.ts`, `src/main/codex-session-monitor.ts`, `src/main/runtime-controller.ts`
- Test: `tests/session-activity-store.test.ts`, `tests/codex-sessions-monitor.test.ts`, `tests/hook-event-bridge.test.ts`, `tests/session-telemetry.test.ts`, `tests/runtime-controller.test.ts`

- [ ] Write failing adapter tests covering known App Server notifications, Hook names, approval/input state, and monitor metadata while asserting serialized observations contain no transcript, cwd, command, or file path.
- [ ] Convert only existing protocol fields into `SessionObservation`. App Server thread/title/capabilities own select/interrupt/steer; pending server-request registries own approval/reply; hooks supplement lifecycle; JSONL monitor supplies only safe telemetry/activity.
- [ ] Replace the single newest-file monitor with one `CodexSessionsMonitor` implementation scanning today/yesterday, selecting at most ten recent JSONL files, retaining per-file offset/partial/telemetry state, limiting tail and total memory, and recovering from missing/truncated/rotated files without publishing paths or parsing message bodies.
- [ ] Write failing storage tests using a temporary directory: local-date rollover, corrupt fallback, future-schema protection, active limit, atomic write path, throttled writes, and flush. Implement a store whose on-disk object is exactly `{ schemaVersion, date, activeMs }`.
- [ ] Inject registry/store seams into `RuntimeController`; route all existing event paths through adapters and derive active count/pet state from arbiter output while preserving the established approval, input, and interrupt APIs.
- [ ] Run focused suites and commit `feat: expose safe multi-session snapshots`.

### Task 4: Publish safe DesktopSnapshot and native session menu summaries

**Files:**

- Modify: `src/shared/ipc-contract.ts`, `src/main/snapshot-assembler.ts`, `src/main/index.ts`, `src/main/menu/menu-view-model.ts`, `src/main/menu/pet-context-menu.ts`, `src/main/tray-manager.ts`, `src/renderer/app/App.tsx`
- Test: `tests/session-snapshot.test.ts`, `tests/snapshot-assembler.test.ts`, `tests/pet-context-menu.test.ts`

- [ ] Write failing snapshot tests that assert `sessionOverview` structured-clones and exposes sanitized title/project/state/timing/capability data only; assert JSON contains no private cwd, JSONL path, prompt, command, tool output, or raw unsafe title.
- [ ] Add `DesktopSessionSummary`, `DesktopSessionOverview`, and safe attention contract types. Preserve legacy `threads`, `selectedThread`, and `activeThreadCount`, deriving the latter from the unified overview.
- [ ] Build shared native-menu view-model functions that show at most five sessions, attention-first, 28-character titles, short state labels and duration formatters. Attach only supported select, interrupt, approval, and reply actions; local-only rows stay disabled. Keep the existing tray click-through recovery, size, Settings, and Exit actions.
- [ ] Add a read-only Settings diagnostics/status overview (counts, today activity, primary safe title) without a Mini Panel or placeholder controls.
- [ ] Run focused suites and commit `feat: show session summaries in desktop menus`.

### Task 5: Complete semantic/regression tests, documentation, and release-quality verification

**Files:**

- Modify: `README.md`, `README.zh-CN.md`, `CHANGELOG.md`, `docs/architecture/ARCHITECTURE.md`, `docs/plans/PROJECT_PLAN.md`
- Create: `docs/architecture/SESSION_INTELLIGENCE.md`, `docs/reports/M4_1_IMPLEMENTATION.md`
- Test: all listed session and existing regression suites

- [ ] Add cross-layer lifecycle/privacy tests for three sessions, stale events, approval/input prioritization, terminal isolation, snapshot sanitization, menu limits/actions, daily-union accounting, and no unbounded monitor/registry growth.
- [ ] Document the three source boundaries, merge precedence, title privacy, clock cap and daily union, arbiter, Snapshot boundary, downstream Behavior Director contract, and deliberately unsupported features.
- [ ] Record automated, packaged, human, and not-run evidence separately. Human validation remains `not run` unless a real App Server event confirms each requested case.
- [ ] Run `npm run format`, `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, and `npm run package:dir`; inspect diff/status for private assets/logs and user-owned changes.
- [ ] Commit tests as `test: verify multi-session lifecycle and privacy`, documentation as `docs: document M4.1 session intelligence`, then push each commit normally.

## Self-Review

- Registry, three adapters, bounded monitor, title privacy, all three timing modes, union ledger, arbiter, snapshots, native menus, compatibility, tests, documentation, and evidence classification each have an owning task.
- Scope exclusions are explicit: no behavior director, animation, sound, growth/token mechanics, MCP, alternate providers, cloud sync, AI title/summarization, Mini Panel, installer, release, signing, or pet changes.
- Type names and constraints are shared from `session-types.ts`; all downstream boundaries consume those contracts rather than raw protocol objects.
