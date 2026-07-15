# Real Codex Approval Test

## Status

- Protocol and routing: verified by generated local App Server types and automated tests.
- Mock UI: verified by the clearly labeled debug request.
- Human end-to-end: not yet verified in this automated environment because it cannot safely click the desktop approval controls on behalf of a user.

## Safe preconditions

1. Start the app with `npm run dev` and leave the pet window visible.
2. Use a disposable project copy. Create only Git-ignored `tmp/approval-test.txt` if a file-change check is needed.
3. Do not use deletion, system settings, downloads, software installation, administrator commands, history rewrites, or force pushes.

## Command allow path

Ask the connected Codex thread to request approval for the harmless command `node --version`.

1. Confirm the pet shows an approval card labelled **Command approval**.
2. Confirm the card is not marked Mock and exposes only the server-offered decisions.
3. Select **Allow** (or the equivalent offered decision).
4. Confirm the command continues and the turn completes.
5. Confirm the request disappears and the pet returns to the active thread state.

## Command deny path

Repeat the harmless command request, then select **Deny**.

1. Confirm the command does not execute.
2. Confirm the card leaves the queue.
3. Confirm the pet is no longer in `approval` unless another pending approval remains.

## File-change path

Request an approval only for `tmp/approval-test.txt` in the disposable project copy.

1. Verify the card identifies a file-change request.
2. Allow or deny it deliberately, then verify the matching outcome.
3. Remove the disposable file manually only if it was created and is known to be safe to remove.

## Redacted diagnostics

The runtime records only the request method, a 12-character SHA-256 request-ID hash, whether thread/turn/item IDs are present, offered decision names, and response success or failure. It never records command text, file content, answer text, token values, credentials, cookies, authorization, or user paths.
