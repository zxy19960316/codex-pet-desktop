import { describe, expect, it } from "vitest";
import { SessionRegistry } from "../src/core/sessions/session-registry";
import type { SessionObservation } from "../src/core/sessions/session-types";

function observation(overrides: Partial<SessionObservation> = {}): SessionObservation {
  return {
    providerId: "codex",
    sessionId: "session-a",
    source: "codex-hooks",
    timestamp: 1_000,
    event: "session_started",
    ...overrides,
  };
}

describe("SessionRegistry", () => {
  it("merges three source observations for one session and preserves App Server capabilities", () => {
    const registry = new SessionRegistry();
    registry.observe(observation({ title: "Build desktop menu", projectLabel: "pet" }));
    registry.observe(
      observation({
        source: "codex-session-file",
        timestamp: 1_100,
        event: "state_changed",
        state: "thinking",
      }),
    );
    registry.observe(
      observation({
        source: "codex-app-server",
        timestamp: 1_200,
        event: "turn_started",
        turnId: "turn-a",
        capabilities: { canSelect: true, canInterrupt: true, canSteer: true },
      }),
    );

    expect(registry.getSession("session-a")).toMatchObject({
      safeTitle: "Build desktop menu",
      state: "working",
      activeTurnId: "turn-a",
      canSelect: true,
      canInterrupt: true,
      canSteer: true,
      sources: ["codex-app-server", "codex-hooks", "codex-session-file"],
    });
  });

  it("keeps newer state when a stale event arrives, revives on a new turn, and makes closed terminal", () => {
    const registry = new SessionRegistry();
    registry.observe(observation({ timestamp: 2_000, event: "turn_started", turnId: "turn-a" }));
    registry.observe(observation({ timestamp: 2_100, event: "turn_completed" }));
    registry.observe(observation({ timestamp: 2_050, event: "state_changed", state: "working" }));
    expect(registry.getSession("session-a")?.state).toBe("success");
    registry.observe(observation({ timestamp: 2_200, event: "turn_started", turnId: "turn-b" }));
    expect(registry.getSession("session-a")).toMatchObject({
      state: "working",
      activeTurnId: "turn-b",
    });
    registry.closeSession("session-a", 2_300);
    registry.observe(observation({ timestamp: 2_400, event: "state_changed", state: "thinking" }));
    expect(registry.getSession("session-a")?.state).toBe("closed");
    registry.observe(observation({ timestamp: 2_500, event: "session_started" }));
    expect(registry.getSession("session-a")?.state).toBe("idle");
  });

  it("sorts attention then active then recency, caps renderer output, and prunes stale records", () => {
    const registry = new SessionRegistry({
      maxSnapshotSessions: 2,
      completedRetentionMs: 10,
      inactiveRetentionMs: 10,
    });
    registry.observe(observation({ sessionId: "idle", timestamp: 1, event: "session_started" }));
    registry.observe(observation({ sessionId: "work", timestamp: 2, event: "turn_started" }));
    registry.observe(observation({ sessionId: "input", timestamp: 3, event: "input_required" }));
    expect(registry.getSnapshot(4).sessions.map((session) => session.sessionId)).toEqual([
      "input",
      "work",
    ]);
    registry.prune(20);
    expect(registry.getSnapshot(20).sessions).toEqual([]);
  });
});
