import { describe, expect, it } from "vitest";
import { parseSessionLifecycle } from "../src/core/codex/session-lifecycle";

function line(type: string, timestamp: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ type, timestamp, payload });
}

describe("Codex session lifecycle parser", () => {
  it("normalizes a complete task into state observations without copying content", () => {
    const secret = "PRIVATE PROMPT CONTENT";
    const content = [
      line("session_meta", "2026-08-09T10:00:00.000Z", {
        id: "session-a",
        cwd: "D:/private/project",
      }),
      line("event_msg", "2026-08-09T10:00:01.000Z", {
        type: "task_started",
        turn_id: "turn-a",
        user_message: secret,
      }),
      line("event_msg", "2026-08-09T10:00:02.000Z", {
        type: "agent_reasoning",
        text: secret,
      }),
      line("response_item", "2026-08-09T10:00:03.000Z", {
        type: "custom_tool_call",
        call_id: "call-a",
        input: secret,
      }),
      line("event_msg", "2026-08-09T10:00:04.000Z", {
        type: "task_complete",
        turn_id: "turn-a",
        last_agent_message: secret,
      }),
    ].join("\n");

    const parsed = parseSessionLifecycle(content);
    expect(parsed.observations).toEqual([
      expect.objectContaining({
        sessionId: "session-a",
        event: "session_started",
        timestamp: Date.parse("2026-08-09T10:00:00.000Z"),
      }),
      expect.objectContaining({
        sessionId: "session-a",
        turnId: "turn-a",
        event: "turn_started",
        state: "working",
      }),
      expect.objectContaining({ sessionId: "session-a", state: "thinking" }),
      expect.objectContaining({ sessionId: "session-a", state: "working" }),
      expect.objectContaining({
        sessionId: "session-a",
        turnId: "turn-a",
        event: "turn_completed",
        state: "success",
      }),
    ]);
    expect(JSON.stringify(parsed)).not.toContain(secret);
    expect(JSON.stringify(parsed)).not.toContain("D:/private/project");
  });

  it("uses turn context and a safe fallback session id when the initial tail misses metadata", () => {
    const parsed = parseSessionLifecycle(
      line("turn_context", "2026-08-09T11:00:00.000Z", {
        turn_id: "turn-b",
        model: "gpt-5",
      }),
      undefined,
      "fallback-session",
    );

    expect(parsed.observations).toEqual([
      expect.objectContaining({
        sessionId: "fallback-session",
        event: "session_started",
      }),
      expect.objectContaining({
        sessionId: "fallback-session",
        turnId: "turn-b",
        event: "turn_started",
        state: "working",
      }),
    ]);
  });

  it("suppresses duplicate state lines across incremental chunks", () => {
    const first = parseSessionLifecycle(
      [
        line("session_meta", "2026-08-09T12:00:00.000Z", { id: "session-c" }),
        line("event_msg", "2026-08-09T12:00:01.000Z", {
          type: "task_started",
          turn_id: "turn-c",
        }),
        line("response_item", "2026-08-09T12:00:02.000Z", { type: "reasoning" }),
        line("event_msg", "2026-08-09T12:00:03.000Z", { type: "agent_reasoning" }),
      ].join("\n"),
    );
    const second = parseSessionLifecycle(
      [
        line("event_msg", "2026-08-09T12:00:04.000Z", { type: "agent_reasoning" }),
        line("response_item", "2026-08-09T12:00:05.000Z", { type: "function_call" }),
        line("response_item", "2026-08-09T12:00:06.000Z", {
          type: "function_call_output",
        }),
      ].join("\n"),
      first.cursor,
    );

    expect(first.observations.map((observation) => observation.state)).toEqual([
      undefined,
      "working",
      "thinking",
    ]);
    expect(second.observations.map((observation) => observation.state)).toEqual(["working"]);
  });

  it("maps failure and interruption terminals and ignores malformed or unsafe records", () => {
    const started = parseSessionLifecycle(
      [
        "not-json",
        line("session_meta", "invalid", { id: "unsafe session id" }),
        line("session_meta", "2026-08-09T13:00:00.000Z", { session_id: "session-d" }),
        line("event_msg", "2026-08-09T13:00:01.000Z", {
          type: "task_started",
          turn_id: "turn-d",
        }),
        line("event_msg", "2026-08-09T13:00:02.000Z", {
          type: "task_failed",
          turn_id: "turn-d",
        }),
      ].join("\n"),
    );
    const interrupted = parseSessionLifecycle(
      [
        line("event_msg", "2026-08-09T13:00:03.000Z", {
          type: "task_started",
          turn_id: "turn-e",
        }),
        line("event_msg", "2026-08-09T13:00:04.000Z", {
          type: "task_cancelled",
          turn_id: "turn-e",
        }),
      ].join("\n"),
      started.cursor,
    );

    expect(started.observations.at(-1)).toMatchObject({ event: "turn_failed", state: "error" });
    expect(interrupted.observations.at(-1)).toMatchObject({
      event: "turn_interrupted",
      state: "interrupted",
    });
  });
});
