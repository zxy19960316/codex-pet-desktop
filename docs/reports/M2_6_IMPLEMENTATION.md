# M2.6 Implementation Report

## Scope and baseline

- Repository: https://github.com/zxy19960316/codex-pet-desktop
- Baseline SHA: faab68c4725e5455fdd591fd9a3cced21d032fff
- First implementation commit: 93b7eda
- Local Codex CLI: 0.144.4
- M3 HUD and pet-pack work are outside this milestone.

## Automated verified

- Native realpath cwd resolver rejects traversal, NUL, renderer absolute paths, symlink or junction escapes, unsafe missing-parent paths, home-root selection, and system-root selection.
- Test threads use a unique tmp/e2e child and fixed untrusted, user-reviewed, workspace-write settings.
- The renderer receives cwd labels and public thread snapshots without internal cwd values. Approval cwd and project paths are reduced to labels or project-relative values.
- E2EVerificationStore covers approval-allow, approval-deny, user-input, steer, and interrupt. It is memory-only and retains short SHA-256 identifiers plus allowlisted protocol event names.
- Snapshot assembly and verification state are outside RuntimeController.
- stopped, error, reconnecting, mock-mode, client replacement, and application-shutdown cleanup share one request-settlement path.
- Re-entrant input submit/server resolution, approval/disconnect, old-client replacement, and transient pet restoration have automated coverage.
- Quality gate at implementation commit: format check passed, lint passed, 25 test files and 69 tests passed, TypeScript/Vite/Electron build passed.

## Protocol verified

Local generated Codex 0.144.4 types confirm:

- ToolRequestUserInputResponse is an optional question-ID answers map with no explicit cancel field.
- TurnSteerParams requires threadId, input, and expectedTurnId.
- TurnInterruptParams requires threadId and turnId.
- Guided approval threads use approvalPolicy untrusted, approvalsReviewer user, and sandbox workspace-write.

The empty input answer map is structurally valid. Live Cancel behavior remains a separate human check.

## Mock verified

Mock approval and user-input cards remain visibly labelled. Mock mode disables all real guided verification actions and triggers the same pending-request cleanup boundary.

## Human E2E verified

Not yet recorded. The application must remain open while a human completes:

- Approval Allow: not verified
- Approval Deny: not verified
- User Input: not verified
- User Input Cancel: not verified
- Steer: not verified
- Interrupt: not verified

## Not verified

- Live App Server acceptance of { answers: {} } as user-input cancellation.
- Five desktop click flows listed above.
- Final smoke launch on the human desktop.

## Safety and privacy

No verification record stores prompt text, command text, command output, cwd, full user answer, token, cookie, authorization value, or raw request/thread/turn ID. The generated protocol folder and local tmp/e2e run data are Git-ignored. No Pokemon or other third-party character assets were added.
