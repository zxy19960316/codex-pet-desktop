Exit code: 0
Wall time: 9.2 seconds
Output:

# M2.6 鐪熶汉 E2E 楠屾敹涓庡畨鍏ㄥ姞鍥?Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Secure developer working-directory selection, make App Server request cleanup race-safe, and provide a guided, truthful five-path desktop verification flow.

**Architecture:** The main process resolves an opaque renderer selection through a realpath-aware boundary module; the renderer receives labels only, never absolute paths. \`RuntimeController\` remains an orchestrator while \`E2EVerificationStore\` owns redacted verification state and \`SnapshotAssembler\` maps internal state to the renderer-safe snapshot. Transport loss follows one cleanup path that rejects every pending server request and resets transient turn/pet state.

**Tech Stack:** Electron 43, TypeScript 6, React 19, Node.js \`fs\` realpath/lstat APIs, Vitest, GitHub Actions.

## Global Constraints

- Preserve MIT license, current behavior, and all existing tests.
- Do not add M3 HUD work, pet packs, Pokemon assets, credentials, local logs, or raw E2E data.
- Use only real App Server protocol events to mark \`human E2E passed\`; mock or automated evidence stays separately labelled.
- Normal developer threads may use project-root child directories; guided test turns always use \`tmp/e2e\`.
- Reject NUL, renderer-supplied absolute paths, user-home/system paths, traversal, and symlink/junction/reparse escapes without including a user path in errors.
- Keep \`tmp/e2e/\` and \`tmp/e2e/results/\` Git-ignored; never persist prompts, commands, cwd values, user answers, tokens, or raw IDs.
- Before every commit run \`npm run format:check\`, \`npm run lint\`, \`npm test\`, and \`npm run build\`; push without force and verify the matching CI run.

## File Structure

| File                                                                                   | Responsibility                                                                                |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| \`src/core/security/safe-path.ts\`                                                     | Canonical-root, component-level lstat, safe creation, and error-redacted cwd resolution.      |
| \`src/core/codex/control-types.ts\`                                                    | Opaque cwd selection, five E2E kinds, guided state, and internal thread contracts.            |
| \`src/core/codex/thread-controller.ts\`                                                | Owns canonical cwd resolver and uses it for ordinary and test thread creation.                |
| \`src/core/codex/turn-controller.ts\`                                                  | Fixed safe prompts for five tests plus sending-state reset.                                   |
| \`src/core/codex/e2e-verification-store.ts\`                                           | Memory-only redacted E2E records and guided step state transitions.                           |
| \`src/main/snapshot-assembler.ts\`                                                     | Converts internal records/threads into renderer-safe snapshots and cwd labels.                |
| \`src/main/runtime-controller.ts\`                                                     | Coordinates controllers, protocol events, test lifecycle, and one transport-unavailable path. |
| \`src/main/ipc-handlers.ts\`, \`src/preload/index.ts\`, \`src/shared/ipc-contract.ts\` | Validates the opaque API surface and exposes only safe IPC operations.                        |
| \`src/renderer/control/*\`                                                             | Fixed cwd selector and guided verification controls; no absolute cwd field.                   |
| \`tests/*\`                                                                            | Focused security, lifecycle/race, E2E store, view-model, IPC, and runtime regressions.        |
| \`docs/*\`                                                                             | Human runbook, architecture, plan/report, and accurate evidence classification.               |

### Task 1: Establish the plan and safe UI boundary

**Files:**

- Create: \`docs/plans/M2_6_E2E_PLAN.md\`
- Modify: \`.gitignore\`
- Test: \`tests/renderer-boundary.test.ts\`

**Interfaces:** Results live locally at \`tmp/e2e/results/latest.json\` and are ignored. The renderer invariant prohibits Node/Electron imports, \`process.cwd()\`, full Windows paths, and an internal \`currentCwd\` property.

- [ ] **Step 1: Add the result ignore rules.**

  tmp/e2e/
  tmp/e2e/results/

- [ ] **Step 2: Extend renderer-boundary coverage.**

  expect(source).not.toMatch(/[A-Za-z]:[\\\\/](?:Users|Windows)[\\\\/]/);
  expect(source).not.toContain("currentCwd");

- [ ] **Step 3: Run \`npm test -- tests/renderer-boundary.test.ts\`.**

Expected: PASS; renderer code cannot read Node/Electron state or display a full cwd.

- [ ] **Step 4: Commit this file with the first implementation milestone.**

  git add docs/plans/M2_6_E2E_PLAN.md .gitignore tests/renderer-boundary.test.ts
  git commit -m "fix: harden developer cwd boundaries"

### Task 2: Enforce canonical cwd boundaries

**Files:**

- Create: \`src/core/security/safe-path.ts\`
- Modify: \`src/core/codex/control-types.ts\`
- Modify: \`src/core/codex/thread-controller.ts\`
- Test: \`tests/safe-path.test.ts\`
- Test: \`tests/thread-controller.test.ts\`

**Interfaces:**

    export type DeveloperCwdSelection =
      | { kind: "project-root" }
      | { kind: "e2e-root" }
      | { kind: "project-relative"; relativePath: string };

    class SafePathResolver {
      resolve(selection: DeveloperCwdSelection, options?: { testOnly?: boolean }): string;
    }

\`ThreadController.create({ cwd: DeveloperCwdSelection }, client)\` is the only point that returns an absolute cwd to the App Server; IPC and the renderer only handle \`DeveloperCwdSelection\`.

- [ ] **Step 1: Write failing security tests.**

  expect(() => resolver.resolve({ kind: "project-relative", relativePath: ".." }))
  .toThrow("Selected folder is not allowed");
  expect(() => resolver.resolve({ kind: "project-relative", relativePath: "a\\0b" }))
  .toThrow("Selected folder is invalid");
  expect(() => resolver.resolve({ kind: "project-relative", relativePath: "C:/Users/x" }))
  .toThrow("Selected folder is invalid");
  expect(() => resolver.resolve({ kind: "project-root" }, { testOnly: true }))
  .toThrow("Verification must use the disposable folder");

- [ ] **Step 2: Run \`npm test -- tests/safe-path.test.ts\` and confirm the expected failure because \`SafePathResolver\` does not exist.**

- [ ] **Step 3: Implement the resolver.**

  resolve(selection, options = {}) {
  const candidate = this.#candidate(selection, options.testOnly === true);
  this.#assertNoNulOrAbsoluteRelativePath(selection);
  this.#assertExistingAncestorsAreSafe(candidate);
  mkdirSync(candidate, { recursive: true });
  const realCandidate = realpathSync.native(candidate);
  if (!isWithin(this.#allowedRoot(selection, options.testOnly === true), realCandidate))
  throw new Error("Selected folder is not allowed");
  return realCandidate;
  }

\`#assertExistingAncestorsAreSafe\` must walk every existing component from the canonical permitted root, call \`lstatSync\`, reject \`isSymbolicLink()\`, and require native realpath containment. Missing directories use their nearest existing canonical parent, are created, then are checked again. Public errors use only fixed messages and never interpolate a path.

- [ ] **Step 4: Add actual and injected filesystem coverage.**

  it("accepts a missing safe child only after creation and a second canonical check", () => {
  expect(resolver.resolve({ kind: "project-relative", relativePath: "tmp/new-child" }))
  .toMatch(/tmp[\\\\/]new-child$/);
  });
  it("rejects an in-root symlink or junction that resolves outside", () => {
  expect(() => symlinkResolver.resolve({ kind: "project-relative", relativePath: "escape" }))
  .toThrow("Selected folder is not allowed");
  });

Cover lexical traversal, absolute path, NUL, symlink/junction/reparse, missing child, legal \`tmp/e2e\`, test-only project-root refusal, and redacted error text.

- [ ] **Step 5: Run \`npm test -- tests/safe-path.test.ts tests/thread-controller.test.ts\`.**

Expected: PASS.

- [ ] **Step 6: Commit.**

  git add src/core/security/safe-path.ts src/core/codex/control-types.ts src/core/codex/thread-controller.ts tests/safe-path.test.ts tests/thread-controller.test.ts .gitignore docs/plans/M2_6_E2E_PLAN.md
  git commit -m "fix: harden developer cwd boundaries"

### Task 3: Extract redacted E2E state and snapshots

**Files:**

- Create: \`src/core/codex/e2e-verification-store.ts\`
- Create: \`src/main/snapshot-assembler.ts\`
- Modify: \`src/core/codex/control-types.ts\`
- Modify: \`src/main/runtime-controller.ts\`
- Modify: \`src/shared/ipc-contract.ts\`
- Test: \`tests/e2e-verification-store.test.ts\`
- Test: \`tests/snapshot-assembler.test.ts\`

**Interfaces:**

    type E2EVerificationKind =
      | "approval-allow" | "approval-deny" | "user-input" | "steer" | "interrupt";

    interface E2EVerificationRecord {
      id: string;
      kind: E2EVerificationKind;
      threadIdHash?: string;
      turnIdHash?: string;
      requestIdHash?: string;
      startedAt: number;
      completedAt?: number;
      result: "running" | "passed" | "failed" | "not-run";
      failureCode?: string;
      protocolEvidence?: string[];
    }

\`E2EVerificationStore\` retains at most 20 in-memory records, hashes identifiers to 12 hex characters, permits failed-to-running-to-passed retry, and accepts no untyped data. \`SnapshotAssembler.build()\` returns \`cwdLabel\` and public thread snapshots that omit internal \`cwd\`.

- [ ] **Step 1: Write failing E2E-store tests.**

  const record = store.start("steer", { threadId: "thread-1", turnId: "turn-1" });
  expect(record).toMatchObject({ result: "running", threadIdHash: expect.stringMatching(/^[a-f0-9]{12}$/) });
  expect(JSON.stringify(store.snapshot())).not.toContain("thread-1");
  expect(JSON.stringify(store.snapshot())).not.toContain("prompt");

- [ ] **Step 2: Write failing snapshot redaction tests.**

  expect(assembler.build({ currentCwd: "C:/Users/private/project" }).currentCwdLabel)
  .toBe("Project root");
  expect(JSON.stringify(assembler.build(internalState))).not.toContain("C:/Users/private");

- [ ] **Step 3: Implement the store and assembler, then run \`npm test -- tests/e2e-verification-store.test.ts tests/snapshot-assembler.test.ts\`.**

Expected: PASS for all five kinds, retry transition, short IDs, memory-only fields, and no renderer-visible absolute path.

- [ ] **Step 4: Commit.**

  git add src/core/codex/e2e-verification-store.ts src/main/snapshot-assembler.ts src/core/codex/control-types.ts src/main/runtime-controller.ts src/shared/ipc-contract.ts tests/e2e-verification-store.test.ts tests/snapshot-assembler.test.ts
  git commit -m "refactor: extract E2E verification state"

### Task 4: Make App Server loss cleanup single-path and race-safe

**Files:**

- Modify: \`src/core/codex/server-request-registry.ts\`
- Modify: \`src/core/codex/turn-controller.ts\`
- Modify: \`src/main/runtime-controller.ts\`
- Test: \`tests/server-request-registry.test.ts\`
- Test: \`tests/runtime-controller.test.ts\`
- Test: \`tests/turn-controller.test.ts\`

**Interfaces:**

    handleTransportUnavailable(reason: string): void
    TurnController.clearSending(): void
    ServerRequestRegistry.clearAll(reason: string): void

- [ ] **Step 1: Write the race tests before code.**

  it("settles a submit and server resolution that occur in the same tick", async () => {
  const submit = router.respond("request", answers);
  registry.resolveFromServer("request");
  await expect(submit).resolves.toBeUndefined();
  expect(router.snapshot()).toEqual([]);
  });
  it("does not register old-client requests after reconnect begins", () => {
  oldClient.requestApproval();
  runtime.handleTransportUnavailable("reconnecting");
  expect(runtime.getSnapshot().approvals).toEqual([]);
  });

Also cover approval/disconnect, turn-completed/input-submit, interrupt/process-exit, and old requests during reconnect.

- [ ] **Step 2: Run \`npm test -- tests/server-request-registry.test.ts tests/runtime-controller.test.ts\` and confirm failure.**

- [ ] **Step 3: Implement exactly-once cleanup.**

  handleTransportUnavailable(reason) {
  this.#serverRequests.clearAll(reason);
  this.#turnController.clearSending();
  this.#testTurns.clear();
  this.#petStateCoordinator.clearTransient();
  this.#e2eStore.failRunning("transport-unavailable", ["transport-unavailable"]);
  this.#emit();
  }

Call it for \`stopped\`, \`error\`, \`reconnecting\`, process exit, application shutdown, and mock-mode enablement. Do not call it on \`connected\` or a normal completed turn. Normal shutdown ends at \`stopped\`, not \`error\`.

- [ ] **Step 4: Run focused lifecycle tests.**

  npm test -- tests/server-request-registry.test.ts tests/runtime-controller.test.ts tests/turn-controller.test.ts tests/input-router.test.ts

Expected: PASS; no pending card, unresolved server-request promise, sending flag, or transient pet state remains after loss.

- [ ] **Step 5: Commit.**

  git add src/core/codex/server-request-registry.ts src/core/codex/turn-controller.ts src/main/runtime-controller.ts tests/server-request-registry.test.ts tests/runtime-controller.test.ts tests/turn-controller.test.ts tests/input-router.test.ts
  git commit -m "fix: unify App Server request cleanup"

### Task 5: Confirm real user-input cancellation semantics

**Files:**

- Modify: \`src/core/input/input-router.ts\`
- Modify: \`src/core/input/input-normalizer.ts\`
- Modify: \`src/renderer/reply/ReplyCard.tsx\`
- Test: \`tests/input-router.test.ts\`
- Test: \`tests/input-normalizer.test.ts\`
- Document: \`docs/reports/M2_6_IMPLEMENTATION.md\`

**Interfaces:** Inspect the locally generated \`item/tool/requestUserInput\` response declaration using \`codex app-server generate-ts --experimental\`. The only two allowed UI outcomes are protocol-confirmed \`{ answers: {} }\` under a \`Cancel\` label, or a \`Dismiss locally\` action that does not fabricate a server response.

- [ ] **Step 1: Generate and inspect local declarations.**

  codex app-server generate-ts --experimental

Record only method/field semantics in documentation; do not commit generated private or session data.

- [ ] **Step 2: Add and run the cancellation contract test.**

  expect(validateCancelResponse(request)).toEqual({ answers: {} });
  expect(() => validateCancelResponse(requiredRequest)).not.toThrow();

- [ ] **Step 3: Implement the generated-protocol-supported behavior.**

If empty answers are valid, retain \`{ answers: {} }\`, record protocol evidence, and retain \`Cancel\`. If not valid, use \`Dismiss locally\`, clear only UI state, and rely on lifecycle cleanup to reject the pending server request. No unverified cancellation is marked passed.

- [ ] **Step 4: Run \`npm test -- tests/input-router.test.ts tests/input-normalizer.test.ts\`.**

Expected: PASS; required-answer validation, truthful cancellation semantics, and no late duplicate response.

### Task 6: Add guided five-path desktop verification

**Files:**

- Create: \`src/renderer/control/verification-view-model.ts\`
- Modify: \`src/renderer/control/CodexControlPanel.tsx\`
- Modify: \`src/core/codex/turn-controller.ts\`
- Modify: \`src/main/runtime-controller.ts\`
- Modify: \`src/main/ipc-handlers.ts\`
- Modify: \`src/preload/index.ts\`
- Modify: \`src/shared/ipc-contract.ts\`
- Test: \`tests/verification-view-model.test.ts\`
- Test: \`tests/ipc-handlers.test.ts\`
- Test: \`tests/runtime-controller.test.ts\`

**Interfaces:**

    runVerification(kind: E2EVerificationKind): Promise<string>
    startVerification(): void
    retryVerification(kind: E2EVerificationKind): Promise<string>
    type VerificationStepState =
      | "not-run" | "waiting-for-user" | "waiting-for-codex" | "passed" | "failed";

All test runs create an isolated ephemeral thread and force a unique \`tmp/e2e/<kind>-<random>\` cwd. Mock data and disconnected App Server disable real verification.

- [ ] **Step 1: Write failing view-model/IPC tests.**

  expect(verificationActions({ protocolSource: "mock", connectionStatus: "connected" })).toEqual({
  canStart: false,
  reason: "Real verification is unavailable while Mock data is enabled",
  });
  expect(verificationActions({ protocolSource: "codex-app-server", connectionStatus: "stopped" }).canStart)
  .toBe(false);

- [ ] **Step 2: Implement fixed safe prompts.**

  const STEER_TEST_PROMPT =
  "Work through a multi-step plain-text outline. Wait for a steer instruction before the final reply; do not use tools, files, network, Git, or credentials.";
  const INTERRUPT_TEST_PROMPT =
  "Produce a long multi-section plain-text outline without tools, files, network, Git, or credentials.";

Approval uses only the already-defined \`node --version\` task; user input asks exactly one harmless A/B question. No test accesses files outside the e2e cwd, network, Git, or credentials.

- [ ] **Step 3: Implement the non-editable cwd selector and guide.**

    <select value={cwdSelection.kind} onChange={selectCwdKind}>
      <option value="project-root">Project root</option>
      <option value="e2e-root">Disposable tmp/e2e</option>
      <option value="project-relative">Project-relative folder</option>
    </select>
    <button disabled={!verification.canStart} onClick={startVerification}>
      Start M2.6 verification
    </button>

Relative text is submitted only as \`project-relative.relativePath\`; absolute strings cannot cross IPC. The guide renders the five named steps, current state, concise instruction, \`Run this step\`, and \`Retry\`.

- [ ] **Step 4: Connect events to truthful state transitions.**

  Approval Allow/Deny: requestApproval -> waiting-for-user -> choice -> serverRequest/resolved -> turn/completed
  User Input: requestUserInput -> waiting-for-user -> answer -> serverRequest/resolved -> turn/completed
  Steer: active turn -> waiting-for-user -> turn/steer same thread/expected turn -> final reply contains STEERED
  Interrupt: active turn -> waiting-for-user -> turn/interrupt same thread/turn -> terminal event

No click alone marks passed. Records retain only method names and short hashes.

- [ ] **Step 5: Run focused tests.**

  npm test -- tests/verification-view-model.test.ts tests/ipc-handlers.test.ts tests/runtime-controller.test.ts

Expected: PASS; controls distinguish real/mock, arbitrary absolute paths cannot be sent, retry works, and passed requires expected evidence.

- [ ] **Step 6: Commit.**

  git add src/renderer/control src/core/codex/turn-controller.ts src/main/runtime-controller.ts src/main/ipc-handlers.ts src/preload/index.ts src/shared/ipc-contract.ts tests/verification-view-model.test.ts tests/ipc-handlers.test.ts tests/runtime-controller.test.ts
  git commit -m "feat: add guided desktop verification"

### Task 7: Documentation, automated validation, and human E2E

**Files:**

- Modify: \`README.md\`
- Modify: \`docs/architecture/ARCHITECTURE.md\`
- Modify: \`docs/plans/PROJECT_PLAN.md\`
- Modify: \`docs/guides/REAL_APPROVAL_TEST.md\`
- Modify: \`docs/guides/REAL_USER_INPUT_TEST.md\`
- Modify: \`docs/guides/REAL_TURN_CONTROL_TEST.md\`
- Create: \`docs/guides/M2_6_DESKTOP_VERIFICATION.md\`
- Create: \`docs/reports/M2_6_IMPLEMENTATION.md\`
- Modify: \`package.json\`

**Interfaces:** \`npm run dev:e2e\` keeps Electron open for manual interaction. Documentation separates exactly: automated verified, protocol verified, mock verified, human E2E verified, and not verified.

- [ ] **Step 1: Add the persistent manual run script.**

  "dev:e2e": "npm run build && electron ."

- [ ] **Step 2: Run complete automated quality gates.**

  npm run format
  npm run format:check
  npm run lint
  npm test
  npm run build

Expected: every command passes before launching the desktop app.

- [ ] **Step 3: Start the real desktop run and wait at each user action.**

  npm run dev:e2e

Expected protocol evidence:

    Approval Allow: item/commandExecution/requestApproval -> accept -> serverRequest/resolved -> turn/completed
    Approval Deny: item/commandExecution/requestApproval -> decline -> serverRequest/resolved -> turn/completed
    User Input: item/tool/requestUserInput -> answer -> serverRequest/resolved -> turn/completed
    Steer: turn/start -> turn/steer same thread/expected turn -> final reply includes STEERED
    Interrupt: turn/start -> turn/interrupt same thread/turn -> terminal event

At each \`waiting-for-user\` terminal state, print the required click, wait for it, and inspect the redacted result. If a step fails, record the actual evidence, fix only the observed defect, rerun its focused test and human step, and never invent a pass.

- [ ] **Step 4: Check repository safety.**

  git status --short
  git diff --check
  git ls-files | Select-String -Pattern 'tmp/e2e|user-pets|pokemon|token|cookie|authorization'

Expected: no tracked local E2E result, asset, credential, authorization, token, cookie, or prohibited character asset.

- [ ] **Step 5: Commit truthful evidence.**

  git add README.md docs/architecture/ARCHITECTURE.md docs/plans/PROJECT_PLAN.md docs/guides/REAL_APPROVAL_TEST.md docs/guides/REAL_USER_INPUT_TEST.md docs/guides/REAL_TURN_CONTROL_TEST.md docs/guides/M2_6_DESKTOP_VERIFICATION.md docs/reports/M2_6_IMPLEMENTATION.md package.json
  git commit -m "docs: record M2.6 completion"

### Task 8: Publish and verify CI

**Files:** No source changes; inspect published commits and workflows.

- [ ] **Step 1: Push each completed milestone.**

  git push origin main

Expected: fast-forward push only; never use a force option.

- [ ] **Step 2: Inspect the workflow for the final SHA.**

  git rev-parse HEAD
  gh run list --limit 10
  gh run view <run-id>

Expected: the workflow attached to the final SHA reports \`format:check\`, \`lint\`, \`test\`, and \`build\` as successful.

- [ ] **Step 3: Report evidence.**

Report the remote URL, baseline SHA, full final SHA, each M2.6 commit, CI URL/status, redacted security/lifecycle results, individual real E2E states including Cancel, automated checks, protocol facts, mock evidence, any not-verified item, known issues, and clean-worktree status. Do not shorten or invent a human E2E result.

## Acceptance Map

| Requirement                                           | Verification task                             |
| ----------------------------------------------------- | --------------------------------------------- |
| Canonical cwd and symlink/junction protection         | Task 2 tests and snapshot redaction test      |
| Cwd IPC redesign and no absolute UI                   | Tasks 2, 3, and 6 IPC/view-model tests        |
| Memory-only five-kind verification store              | Task 3 store tests                            |
| Runtime responsibility reduction                      | Task 3 extraction and Task 4 coordinator      |
| stopped/error/reconnecting/shutdown cleanup and races | Task 4 lifecycle tests                        |
| User-input Cancel semantics                           | Task 5 generated protocol inspection and test |
| Guided five-path controls                             | Task 6 UI/runtime tests                       |
| Real human five-path E2E                              | Task 7 user-assisted app run                  |
| Docs, clean tree, commits, push, CI                   | Tasks 7 and 8                                 |

## Self-Review

- Every requested M2.6 area maps to a file, an automated test, and鈥攚here a real server response is required鈥攁 distinct manual protocol event.
- The plan never records full cwd, prompt, command, answer, token, raw ID, or local result data in committed artifacts.
- All IPC names, data types, test kinds, lifecycle names, and cwd selection values are defined before later tasks use them.
- The human test is a completion gate: a blocked or failed step remains explicitly \`not verified\` or \`failed\` in the final report.
