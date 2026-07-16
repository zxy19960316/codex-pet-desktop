import { describe, expect, it } from "vitest";
import { hookEventToPetState, parseCodexHookEvent } from "../src/core/codex/hook-event";

describe("Codex hook events", () => {
  it("keeps only lifecycle identifiers and ignores prompt content", () => {
    expect(
      parseCodexHookEvent({
        session_id: "session-1",
        turn_id: "turn-1",
        hook_event_name: "UserPromptSubmit",
        prompt: "must not be copied",
      }),
    ).toMatchObject({
      sessionId: "session-1",
      turnId: "turn-1",
      name: "UserPromptSubmit",
    });
  });

  it("maps lifecycle events to pet states and returns Stop to idle", () => {
    const stop = hookEventToPetState({
      sessionId: "session-1",
      turnId: "turn-1",
      name: "Stop",
      timestamp: 10,
    });
    expect(stop).toMatchObject({ state: "success", transientReturnState: "idle" });
    expect(
      hookEventToPetState({
        sessionId: "session-1",
        name: "PermissionRequest",
        timestamp: 10,
      }).state,
    ).toBe("approval");
  });
});
