import { describe, expect, it } from "vitest";
import { formatTokenCount, rateLimitLabel } from "../src/renderer/hud/hud-view-model";

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
});
