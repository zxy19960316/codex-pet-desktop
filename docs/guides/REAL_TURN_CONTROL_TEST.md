# Real Codex Turn-Control Test

## Status

- Protocol shape: verified locally with Codex CLI `0.144.4` generated types.
- Automated controller behavior: verified by Vitest.
- Mock UI: the existing Mock approval/input controls remain separate from these real controls.
- Human desktop E2E: not run by automation; complete the steps below manually.

## Preconditions

1. Run `npm run dev`, enable Debug controls, and wait for a real App Server connection.
2. Confirm the panel says **Developer controls** and the cwd is the project root or `tmp/e2e/`.
3. Do not use source paths, home directories, network tasks, Git operations, or credentials.

## Thread and start

1. Select **Create disposable thread** and select it from the thread list.
2. Enter a harmless prompt and select **Start normal turn**.
3. Confirm the active-turn short ID appears and only that selected thread is targeted.

## Steer and interrupt

1. While the selected thread is still active, enter a harmless steering message and select
   **Steer**. Confirm it remains in the same thread and turn.
2. Start another safe active turn, select **Interrupt active turn**, and wait for a real
   `turn/completed`/interruption notification. The UI must not claim completion before that event.

## Cleanup

1. Confirm completed, closed, and deleted threads clear their pending approval/input cards.
2. Stop the App Server and confirm pending cards clear rather than leaving unresolved controls.
3. Record each manual outcome separately from Mock results in the M2.5 report.
