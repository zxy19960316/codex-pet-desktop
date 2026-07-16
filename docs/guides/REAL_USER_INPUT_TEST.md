# Real Codex User-Input Test

## Protocol basis

This implementation was checked against local `codex app-server generate-ts --experimental` output from Codex CLI `0.144.4`.

- Request method: `item/tool/requestUserInput`
- Params: `threadId`, `turnId`, `itemId`, `questions`, and nullable `autoResolutionMs`
- Question: `id`, `header`, `question`, `isOther`, `isSecret`, and nullable options
- Response: `{ answers: Record<questionId, { answers: string[] }> }`

Only the normalized request and validated domain answers cross the renderer/main boundary. Full answers are not written to diagnostics.

## Status

- Protocol normalization and response serialization: verified by automated tests.
- Mock reply cards: available from **Enqueue Mock User Input**; they rotate through one choice, multiple choices, and free text, and are visibly marked **Mock request**.
- Human end-to-end: not yet verified in this automated environment because it cannot submit a desktop reply card as the user.

## Safe manual reproduction

1. Start `npm run dev` and connect the local App Server.
2. In a disposable thread, ask Codex to use its `request_user_input` capability for a harmless preference such as “Choose A or B before continuing.”
3. Confirm the pet enters `waiting_input` and a non-Mock reply card shows the thread short ID and question text.
4. Submit an offered option or permitted free text. Use Shift+Enter to add a newline; Enter submits.
5. Confirm the answer is returned for the same JSON-RPC request ID, Codex continues, the turn completes, and the card disappears.
6. Repeat with cancellation and with a deliberately expired request where available.

Do not use keyboard simulation, do not submit secrets, and do not treat Mock results as real App Server verification.

## M2.6 guided entry and cancellation

Enable Debug controls and select **Run real user-input test** to create an ephemeral `tmp/e2e/`
thread and send the fixed harmless request for A/B plus Other free text. The generated `0.144.4`
protocol has no explicit cancellation response for `item/tool/requestUserInput`; its response shape
is `{ answers: Record<questionId, { answers: string[] }> }`. The current Cancel button therefore
sends the structurally valid empty mapping `{ answers: {} }` and clears the card. This is
protocol/automated evidence only: manually verify the App Server's runtime behavior before treating
it as a successful cancellation result.

The M2.6 panel replaces manual prompt construction: select **Start M2.6 verification**, then
**Run this step** under User Input. A normal answer requires the real request, same-ID response,
server resolution, and turn completion. Run one extra retry with Cancel to record the live empty-map
behavior separately; cancellation does not count as the main User Input pass.
