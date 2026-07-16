# M2.6 Desktop Verification Guide

## Preconditions

1. Use Codex CLI 0.144.4 or the installed compatible version.
2. Turn Mock data off and wait until the panel reports a connected Codex App Server.
3. Enable Debug controls.
4. Start the persistent desktop process with:

       npm run dev:e2e

5. Keep the application open while each step is waiting for user input.

Every guided test creates a new ephemeral thread in a unique Git-ignored tmp/e2e child. The fixed prompts prohibit network, file changes, Git, installation, and credential access. The renderer shows Project root, Disposable tmp/e2e, or Project-relative folder instead of a local absolute cwd.

## Ordered human checks

Select **Start M2.6 verification**, then complete these steps in order.

### 1. Approval Allow

1. Select **Run this step** for Approval Allow.
2. Wait for a card titled **M2.6 Approval Allow Test**.
3. Confirm the command targets only the fixed `m2-6-nonexistent-probe` name and the cwd is shown only as Disposable tmp/e2e. The target is guaranteed absent, so Allow produces no filesystem side effect.
4. Select **Allow**.
5. Wait for the step to report passed. A click alone is not sufficient; the runtime also requires serverRequest/resolved and turn/completed.

### 2. Approval Deny

1. Select **Run this step** for Approval Deny.
2. Wait for **M2.6 Approval Deny Test**.
3. Select **Deny**.
4. Confirm the command did not run, the card cleared, and the step reports passed after the real terminal event.

### 3. User Input

1. Select **Run this step** for User Input.
2. Wait for **M2.6 User Input Test**.
3. Choose A or B and select **Send**.
4. Confirm the card clears, Codex continues, and the step reports passed only after the same request ID is resolved and the turn completes.

### 4. Steer

1. Select **Run this step** for Steer.
2. When it reports waiting-for-user, select **Send fixed steer**.
3. Confirm the same active turn receives the instruction.
4. Confirm the final reply contains the exact word STEERED and the step reports passed.

### 5. Interrupt

1. Select **Run this step** for Interrupt.
2. When it reports waiting-for-user, select **Interrupt now**.
3. Wait for a real interrupted or cancelled terminal status.
4. Confirm the active turn and pending cards clear and the step reports passed.

## Cancel semantics check

The locally generated ToolRequestUserInputResponse type is an answers map with optional question keys and no explicit cancel field. The Cancel button sends the structurally valid empty mapping { answers: {} }. Run one extra User Input step and select Cancel to verify whether the live App Server accepts this response. Until the live server confirms it, record Cancel as protocol verified but human runtime not verified.

## Failure handling

- approval-not-requested means the real App Server did not request approval; inspect the approval policy and sandbox, then retry.
- turn-finished-before-steer means the test turn ended too quickly; retry the isolated step.
- steer-evidence-missing means the final agent message did not include STEERED.
- interrupt-not-observed means the terminal event did not report interrupted or cancelled.
- transport-unavailable means stopped, error, reconnecting, mock mode, or shutdown cleared the running test.

Never convert a failed or running step into a human pass manually. Retry only the affected step and keep Mock evidence separate.
