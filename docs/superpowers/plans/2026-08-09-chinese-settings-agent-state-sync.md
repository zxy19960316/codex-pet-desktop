# Chinese Settings and Agent State Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize every user-facing Settings Center string into Simplified Chinese and make the desktop pet react to the lifecycle of locally running Codex tasks, including a short terminal animation before returning to idle.

**Architecture:** Keep the secure Settings Window and its IPC contract intact, moving only display-label translation into a small renderer helper. Extend the existing privacy-safe Codex JSONL tailer with a pure lifecycle parser that reads only event type, timestamp, session ID, and turn ID. Batch normalized `SessionObservation` values into `RuntimeController`, where the existing `SessionRegistry` and attention arbiter remain the single source of truth for pet state.

**Tech Stack:** TypeScript 6, React 19, Electron, Vitest, Vite, esbuild.

**Global Constraints:** Preserve all pre-existing worktree changes; do not modify bundled or user-imported pet assets; never retain or publish prompt, response, command, cwd, or raw JSONL content; do not treat local session-file monitoring as an App Server connection; do not commit or push.

---

## Task 1: Lock the Chinese Settings contract with failing tests

**Files:**

- Create: `tests/settings-localization.test.ts`
- Modify: `tests/settings-ipc-validation.test.ts`
- Create: `src/renderer/settings/settings-copy.ts`

- [x] Add a localization test that asserts `settings.html` uses `lang="zh-CN"`, the window title is `Codex Pet 设置中心`, and the Settings renderer contains key Chinese navigation, status, pet, quota, diagnostics, and about copy.
- [x] Add pure label-mapping tests for every `AppServerStatus`, protocol source, settings load state, and pet package origin.
- [x] Extend the secure Settings Window test to assert the Chinese BrowserWindow title without weakening its isolation and sandbox assertions.
- [x] Run only the localization and Settings IPC tests and confirm the new assertions fail for the current English UI.

## Task 2: Localize the complete Settings Center

**Files:**

- Modify: `settings.html`
- Modify: `src/main/windows/settings-window-manager.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/settings/SettingsApp.tsx`
- Modify: `src/renderer/settings/PetSelector.tsx`
- Modify: `src/renderer/settings/settings.css`
- Modify: `src/renderer/settings/settings-copy.ts`

- [x] Implement exhaustive Chinese labels for connection status, protocol source, load state, and pet origin; unknown external values must use a safe Chinese fallback while user-authored pet names and metadata stay unchanged.
- [x] Translate all headings, navigation labels, descriptions, buttons, counters, empty states, progress text, accessibility labels, errors, quota copy, diagnostics, and third-party asset notices.
- [x] Translate Settings-related native dialogs and file-picker titles in the main process.
- [x] Add Chinese-friendly system fonts while preserving the current visual layout.
- [x] Run the focused Settings tests and confirm they pass.

## Task 3: Parse local Codex lifecycle events without reading content

**Files:**

- Create: `src/core/codex/session-lifecycle.ts`
- Create: `tests/session-lifecycle.test.ts`
- Modify: `src/main/codex-session-monitor.ts`
- Modify: `tests/codex-sessions-monitor.test.ts`

- [x] Write failing parser tests covering `session_meta`, `task_started`, reasoning, tool work, `task_complete`, failure, interruption, duplicate suppression, malformed lines, and a fallback session ID.
- [x] Implement a line-oriented pure parser that reads only `type`, `timestamp`, `payload.type`, `payload.id`/`session_id`, and `turn_id`, producing normalized `SessionObservation` values.
- [x] Extend each monitor cursor with lifecycle state and derive a fallback session ID from the rollout filename UUID when an initial tail starts after `session_meta`.
- [x] Batch newly parsed observations through an optional `onObservations` callback while leaving telemetry behavior unchanged.
- [x] Add a monitor integration test that appends lifecycle lines and proves observations are emitted once without exposing message content.
- [x] Run the lifecycle and monitor tests and confirm they pass.

## Task 4: Drive pet animation from task activity

**Files:**

- Modify: `src/main/runtime-controller.ts`
- Modify: `src/main/index.ts`
- Modify: `src/shared/ipc-contract.ts`
- Modify: `src/shared/ipc/settings-ipc.ts`
- Modify: `tests/runtime-controller.test.ts`

- [x] Add failing RuntimeController tests showing local `turn_started` produces `working`, reasoning produces `thinking`, tool activity returns to `working`, and completion produces `success` then `idle` after the terminal display interval.
- [x] Add `codex-session-file` to the snapshot protocol-source contract and wire monitor observations into RuntimeController.
- [x] Observe local session batches only outside mock mode, preserve App Server/hook source precedence, update the last active session, and publish once per batch.
- [x] Keep success/error visible for about 2.5 seconds, schedule one safe refresh, cancel stale timers when new work starts, and return the pet to idle without deleting session history.
- [x] Run RuntimeController, IPC, lifecycle, and monitor tests and confirm they pass.

## Task 5: Verify the integrated desktop change

**Files:**

- Modify only files already listed if verification exposes a defect.

- [x] Run Prettier on the touched files and confirm formatting checks.
- [x] Run the complete unit test suite.
- [x] Run lint and the production build.
- [x] Audit the final diff and working tree to prove pre-existing unrelated changes were preserved and no asset files were changed.
- [x] Record the exact passing commands and any remaining manual-only validation in the handoff.

## Task 6: Diagnose the running artifact and the live session feed

**Files:**

- Read: `release/Codex Pet Desktop-win32-x64/resources/app.asar`
- Read: `%USERPROFILE%/.codex/sessions/YYYY/MM/DD/*.jsonl`
- Modify only if a live-format mismatch is proven: `src/core/codex/session-lifecycle.ts`
- Test only if a live-format mismatch is proven: `tests/session-lifecycle.test.ts`

**Interfaces:**

- Consumes: `parseSessionLifecycle(content, initial, fallbackSessionId)` and the packaged Electron `app.asar`.
- Produces: an artifact identity result and metadata-only lifecycle observations containing no prompt, response, command, cwd, or raw JSONL content.

- [x] Confirm the executable path and process IDs of every running `Codex Pet Desktop.exe` instance; only the exact repository `release/Codex Pet Desktop-win32-x64` process is in scope.
- [x] Inspect the current packaged `app.asar` for the old English title and compare its modification time with the successful source build.
- [x] Parse the newest live session tails with `parseSessionLifecycle`, printing only filename, session ID, event, state, turn ID, and timestamp.
- [x] If the live event shape is unsupported, add the exact metadata-only shape to `tests/session-lifecycle.test.ts`, confirm failure, implement the smallest parser correction, and rerun the focused tests. No mismatch was found, so no parser change was required.

## Task 7: Replace and verify the packaged application

**Files:**

- Rebuild: `release/Codex Pet Desktop-win32-x64/**`
- Preserve: `%APPDATA%/Codex Pet Desktop/**`
- Preserve: `tmp/local-pokepets/**`

**Interfaces:**

- Consumes: `npm run package:dir`, `npm run verify:m3-2`, and the existing managed user-data pet registry.
- Produces: a newly packaged and relaunched `Codex Pet Desktop.exe` whose Settings title is `Codex Pet 设置中心` and whose local session source drives the pet state.

- [x] Stop only the repository release executable and its child processes after verifying their absolute executable paths; do not stop unrelated Electron applications.
- [x] Run `npm run package:dir` and require exit code `0` before launching anything.
- [x] Inspect the rebuilt `app.asar` and require the Chinese Settings title plus the `codex-session-file` protocol source.
- [x] Run `npm run verify:m3-2`; report packaged verification separately from unit/build evidence and do not relabel a blocked or failed run as passed.
- [x] Launch the rebuilt release executable with the existing `%APPDATA%/Codex Pet Desktop` profile and confirm its absolute process path.
- [x] Re-read the live session metadata while the task is active and confirm the latest observation resolves to `thinking` or `working`; after task completion, the runtime test remains the evidence for the `success` to `idle` transition. The packaged renderer was also inspected read-only and reported `working` for the shell, sprite, animation, and runtime snapshot.
