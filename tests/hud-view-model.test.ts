import { describe, expect, it } from "vitest";
import {
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
});
