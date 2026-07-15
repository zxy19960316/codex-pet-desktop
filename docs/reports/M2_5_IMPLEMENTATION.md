# M2.5 Implementation Report

## Scope and protocol basis

- Baseline SHA: `3b507884048c9467096b781b83f0a1c7efac010d`
- Repository: `https://github.com/zxy19960316/codex-pet-desktop`
- Local CLI: Codex `0.144.4`; types generated with `codex app-server generate-ts --out <temp> --experimental`

The generated protocol confirms `thread/start` accepts `cwd`, `ephemeral`, `approvalPolicy`,
`approvalsReviewer`, and `sandbox`; `turn/start` accepts a `threadId` and text `input` array;
`turn/steer` requires `threadId`, text `input`, and `expectedTurnId`; `turn/interrupt` requires
`threadId` and `turnId`. The approval policy enum includes `untrusted`, `on-request`, `never`, and
granular policy; developer threads use fixed `untrusted`. The generated user-input response type has
only `answers`; it has no explicit cancel response.

## Delivered

- `ThreadController` validates developer cwd, creates ephemeral threads, tracks selected/recent
  thread metadata, and removes closed/deleted threads.
- `TurnController` owns real start/steer/interrupt requests, enforces active-turn ownership, and
  provides fixed harmless approval and user-input test prompts.
- `RuntimeController` composes controllers, derives current cwd from selected/recent threads,
  clears server requests on stopped/error states, clears turn requests on completion, and retains
  only hashed in-memory E2E interaction records.
- The frozen preload contract exposes seven typed control actions, never generic protocol calls.
- Debug-only Developer controls provide disposable thread creation, selection, normal/test turns,
  steer, interrupt, active-turn short ID, connection state, and action outcome state.

## Verification status

- Automated verified: format check, lint, TypeScript build, 20 Vitest files / 56 tests.
- Protocol verified: local generated CLI types for thread, turn, approval, sandbox, and input shapes.
- Mock UI verified: existing explicit Mock approval/input flows; they are not reported as real E2E.
- Human E2E verified: not run in this automated environment.
- Not verified: manual Approval Allow, Approval Deny, user-input submission, steer, and interrupt;
  use the three guides under `docs/guides/` and record actual desktop results separately.
- Smoke verified: bounded Mock desktop launch rendered the HUD, Debug controls, Developer controls,
  Mock approval card, tray, 11 state buttons, and drag region, then requested graceful quit.

## Lifecycle and privacy

Approval and input queues restore normal state after resolution; turn completion clears matching
approval and input requests; thread end removes thread metadata, selection, token state, and pet
state; App Server stopped/error clears every pending server request. Full prompts, commands, user
answers, and full paths are not sent to diagnostics or the E2E record list.
