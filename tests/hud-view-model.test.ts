import { describe, expect, it } from "vitest";
import {
  buildBattleHudViewModel,
  compactBucketLabel,
  formatTokenCount,
  rateLimitLabel,
  selectCompactBuckets,
} from "../src/renderer/hud/hud-view-model";

describe("HUD view model", () => {
  it("labels unavailable token data without fabricating a value", () => {
    expect(formatTokenCount(null)).toBe("Data unavailable");
    expect(formatTokenCount(1234)).toMatch(/1.234|1,234|1 234/);
  });

  it("uses dynamic quota labels rather than hard-coded window names", () => {
    expect(
      rateLimitLabel({
        id: "custom",
        usedPercent: 1,
        remainingPercent: 99,
        windowDurationMins: 90,
        resetsAt: 1,
        source: "mock",
      }),
    ).toBe("90 min window");
  });

  it("selects the shortest and weekly buckets for the compact sketch layout", () => {
    const fiveHour = {
      id: "five-hour",
      usedPercent: 40,
      remainingPercent: 60,
      windowDurationMins: 300,
      resetsAt: 1,
      source: "mock" as const,
    };
    const weekly = {
      ...fiveHour,
      id: "weekly",
      windowDurationMins: 10_080,
    };
    expect(selectCompactBuckets([weekly, fiveHour])).toEqual([fiveHour, weekly]);
    expect(selectCompactBuckets(null)).toEqual([null, null]);
    expect(compactBucketLabel(fiveHour, 0)).toBe("5h");
    expect(compactBucketLabel(weekly, 1)).toBe("weekly");
  });

  it("maps five-hour and weekly limits into bounded battle rows", () => {
    const base = {
      id: "five-hour",
      usedPercent: 40,
      remainingPercent: 62.4,
      windowDurationMins: 300,
      resetsAt: 1,
      source: "mock" as const,
    };
    expect(
      buildBattleHudViewModel({
        buckets: [
          { ...base, id: "weekly", remainingPercent: 138, windowDurationMins: 10_080 },
          base,
        ],
        model: null,
        reasoningEffort: null,
        currentTokens: null,
        contextWindowTokens: null,
      }).bars,
    ).toEqual([
      { kind: "five-hour", label: "5H", value: 62 },
      { kind: "weekly", label: "WEEKLY", value: 100 },
    ]);
  });

  it("collapses to WEEKLY when the account has no five-hour limit", () => {
    const weekly = {
      id: "weekly",
      usedPercent: 38,
      remainingPercent: 62,
      windowDurationMins: 10_080,
      resetsAt: 1,
      source: "codex-session" as const,
    };
    expect(
      buildBattleHudViewModel({
        buckets: [weekly],
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
        currentTokens: 178_807,
        contextWindowTokens: 258_400,
      }),
    ).toEqual({
      model: "GPT-5.6-SOL",
      reasoningEffort: "HIGH",
      bars: [{ kind: "weekly", label: "WEEKLY", value: 62 }],
      tokens: "178.8K / 258.4K",
    });
  });
});
