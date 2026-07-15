# M2.5 Codex Turn Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, explicit App Server thread and turn controls plus verifiable real-request test entry points.

**Architecture:** Keep App Server parameter construction in `ThreadController` and `TurnController`; `RuntimeController` composes those controllers with normalized events and request routing. The renderer receives only a narrow IPC surface and renders developer controls only when debug mode is visible.

**Tech Stack:** Electron, React, TypeScript, Vitest, Codex App Server 0.144.4.

## Global Constraints

- Do not add arbitrary JSON-RPC IPC methods or renderer-selected sandbox/approval settings.
- Control cwd is limited to the repository root or `tmp/e2e` and descendants; test prompts forbid network, Git, credentials, and source changes.
- Keep full prompts, absolute user paths, command bodies, and IDs out of persistent diagnostics.
- Preserve existing approval and user-input behavior and run format, lint, test, and build before commits.

---

### Task 1: Build controller domain and safety boundary

**Files:** Create `src/core/codex/control-types.ts`, `src/core/codex/thread-controller.ts`, `src/core/codex/turn-controller.ts`; test `tests/thread-controller.test.ts`, `tests/turn-controller.test.ts`.

- [ ] Write failing tests for cwd normalization, thread creation, active-turn ownership, steer preconditions, and interrupt delegation.
- [ ] Implement the smallest controllers that construct generated-protocol-compatible `thread/start`, `turn/start`, `turn/steer`, and `turn/interrupt` requests.
- [ ] Run the focused tests, then commit `refactor: add thread and turn controllers`.

### Task 2: Compose runtime and strict IPC

**Files:** Modify `src/main/runtime-controller.ts`, `src/main/ipc-handlers.ts`, `src/shared/ipc-contract.ts`, `src/preload/index.ts`; test `tests/runtime-controller.test.ts`.

- [ ] Add failing tests for selected-thread cwd, server-stop cleanup, and typed control actions.
- [ ] Wire controllers through `RuntimeController`, validate all renderer data in IPC, and expose only the seven named control calls.
- [ ] Run focused tests, then commit `feat: add safe Codex developer controls`.

### Task 3: Add developer UI and lifecycle hardening

**Files:** Create `src/renderer/control/CodexControlPanel.tsx`, `src/renderer/control/control-view-model.ts`; modify `src/renderer/app/App.tsx`, `src/renderer/styles/base.css`, `src/core/input/input-router.ts`; test request lifecycle and renderer boundary.

- [ ] Add failing lifecycle tests for submit/server-resolved races, completion cleanup, and disconnect cleanup.
- [ ] Render a debug-only panel with create, start, test, steer, interrupt, and selection controls; make request state status visible without retaining prompt bodies.
- [ ] Run focused tests, then commit `fix: harden request lifecycle cleanup`.

### Task 4: Document and verify

**Files:** Modify `README.md`, `docs/architecture/ARCHITECTURE.md`, `docs/plans/PROJECT_PLAN.md`, `docs/guides/REAL_APPROVAL_TEST.md`, `docs/guides/REAL_USER_INPUT_TEST.md`; create `docs/guides/REAL_TURN_CONTROL_TEST.md`, `docs/reports/M2_5_IMPLEMENTATION.md`.

- [ ] Record generated-protocol findings, test boundaries, and manual E2E status separately from mocks.
- [ ] Run `npm run format`, `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, and a smoke launch.
- [ ] Inspect the diff, commit the documentation, push `main`, and verify the resulting CI run.
