# M1.5 and M2 Implementation Report

## Scope and baseline

- Baseline SHA: `89f2271342177debb8ec14cd70b1e00b13026346`
- Repository: `https://github.com/zxy19960316/codex-pet-desktop`
- Local protocol source: Codex CLI `0.144.4`, generated with `codex app-server generate-ts --experimental`
- New dependencies: none

## Delivered architecture

`src/main/index.ts` now contains Electron lifecycle, single-instance handling, window/tray/IPC composition, smoke wiring, and quit sequencing only. `RuntimeController` owns App Server lifecycle, normalized notifications, snapshots, settings-driven connection behavior, usage refresh, request cleanup, and mock controls without starting an Electron window.

`ServerRequestRegistry` registers the three approval request methods and `item/tool/requestUserInput`. Approval state remains first priority; otherwise pending input yields `waiting_input`, and the runtime restores the tracked thread state after queue cleanup.

Thread token usage is stored as `Map<string, ThreadTokenUsage>` and serialized as `threadTokenUsage`. The HUD value is `currentThreadTokens`, sourced from the selected thread or the most recently active thread. Closing or deleting a thread removes its usage entry. Token payloads are not logged.

## M2 request/reply protocol

The local generated protocol defines a request with `threadId`, `turnId`, `itemId`, `questions`, and `autoResolutionMs`. The response returned to the same JSON-RPC request is:

```ts
{
  answers: Record<string, { answers: string[] }>;
}
```

`InputRouter` queues explicitly bound requests, rejects duplicate IDs and duplicate sends, validates answers, supports cancellation and timeout, and clears requests on server resolution, turn completion, thread end, App Server disconnect, and application shutdown. The renderer cannot choose a JSON-RPC method or inject arbitrary protocol fields; it can call only the three allowlisted user-input IPC actions.

The reply card supports single-choice, mock multi-choice, free text, multiple questions, required-answer validation, cancellation, queue count, Send state, Enter submit, and Shift+Enter newline. Real generated requests have no multi-select field and therefore default to one choice; the mock exercises the optional multi-select UI path.

## Verification status

- CI workflow fix: `actions/setup-node@v6` plus a local static regression test.
- Automated tests: 18 files, 48 tests at the last pre-documentation quality run.
- Format, lint, tests, and build: passed at that run.
- Manual smoke launch: passed three bounded runs. Mock approval and Mock user-input runs each
  showed the expected card, HUD, tray, 11 debug states, and drag region; a real App Server run
  reached `connected`. All three requested graceful quit with no project Electron or App Server
  process left behind.
- Protocol verification: passed through local generated types and deterministic tests.
- Mock approval and user-input routing: deterministic test coverage and visible debug controls available.
- Human real Allow/Deny: not yet verified; see `docs/guides/REAL_APPROVAL_TEST.md`.
- Human real requestUserInput: not yet verified; see `docs/guides/REAL_USER_INPUT_TEST.md`.
- `turn/steer`: deliberately deferred; it is not required for M2 request/reply acceptance.

## Privacy and diagnostics

Approval diagnostics record only request method, short request-ID hash, identifier presence, offered decision names, and response outcome. Input replies and token values are never persisted to diagnostics.

## Known limitations and next step

Automated validation cannot impersonate a user clicking the desktop UI, so the two manual guides remain required evidence for real end-to-end approval and input confirmation. The next milestone should perform those guided checks on a local desktop, then consider a separately scoped `turn/steer` feature bound to explicit `threadId` and `expectedTurnId`.
