import { describe, expect, it } from "vitest";
import { parseSessionTelemetry } from "../src/core/codex/session-telemetry";

describe("Codex session telemetry", () => {
  it("extracts only model, effort, current/context tokens, and weekly-only quota", () => {
    const input = [
      JSON.stringify({
        type: "turn_context",
        payload: {
          model: "gpt-5.6-sol",
          effort: "high",
          cwd: "C:\\private\\project",
          developer_instructions: "must never leave main",
        },
      }),
      JSON.stringify({
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: { total_tokens: 60_579_231 },
            last_token_usage: { total_tokens: 178_807 },
            model_context_window: 258_400,
          },
          rate_limits: {
            primary: { used_percent: 38, window_minutes: 10_080, resets_at: 1_785_294_413 },
            secondary: null,
          },
        },
      }),
    ].join("\n");

    expect(parseSessionTelemetry(input)).toEqual({
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
      currentTokens: 178_807,
      contextWindowTokens: 258_400,
      rateLimits: [
        {
          id: "session-primary",
          label: "Weekly",
          usedPercent: 38,
          remainingPercent: 62,
          windowDurationMins: 10_080,
          resetsAt: 1_785_294_413_000,
          source: "codex-session",
        },
      ],
    });
    expect(JSON.stringify(parseSessionTelemetry(input))).not.toContain("private");
    expect(JSON.stringify(parseSessionTelemetry(input))).not.toContain("instructions");
  });

  it("returns null for unrelated or malformed session lines", () => {
    expect(
      parseSessionTelemetry('{"type":"response_item","payload":{"text":"secret"}}'),
    ).toBeNull();
    expect(parseSessionTelemetry("{broken")).toBeNull();
  });
});
