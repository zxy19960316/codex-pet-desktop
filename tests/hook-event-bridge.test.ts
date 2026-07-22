import { describe, expect, it } from "vitest";
import { recentHookEvents } from "../src/main/hook-event-bridge";

describe("hook event bridge startup replay", () => {
  it("replays valid recent events for already-open agents and ignores stale history", () => {
    const now = 1_000_000;
    const content = [
      JSON.stringify({ sessionId: "stale", name: "PreToolUse", timestamp: now - 600_001 }),
      "{malformed",
      JSON.stringify({ sessionId: "active", name: "UserPromptSubmit", timestamp: now - 10_000 }),
    ].join("\n");

    expect(recentHookEvents(content, now, 600_000)).toEqual([
      { sessionId: "active", name: "UserPromptSubmit", timestamp: now - 10_000 },
    ]);
  });
});
