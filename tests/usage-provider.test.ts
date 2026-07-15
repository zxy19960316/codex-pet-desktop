import { describe, expect, it } from "vitest";
import {
  CodexUsageProvider,
  formatResetCountdown,
  normalizeRateLimitBucket,
  sortRateLimitBuckets,
} from "../src/core/codex/usage-provider";

describe("usage helpers", () => {
  it("clamps remaining percentage from used percentage", () => {
    expect(
      normalizeRateLimitBucket({ id: "a", usedPercent: 140, windowDurationMins: 60, resetsAt: 0 })
        .remainingPercent,
    ).toBe(0);
    expect(
      normalizeRateLimitBucket({ id: "b", usedPercent: -10, windowDurationMins: 60, resetsAt: 0 })
        .remainingPercent,
    ).toBe(100);
  });

  it("sorts dynamic quota buckets by window duration", () => {
    const buckets = [
      normalizeRateLimitBucket({
        id: "long",
        usedPercent: 20,
        windowDurationMins: 10080,
        resetsAt: 0,
      }),
      normalizeRateLimitBucket({
        id: "short",
        usedPercent: 20,
        windowDurationMins: 300,
        resetsAt: 0,
      }),
    ];
    expect(sortRateLimitBuckets(buckets).map((bucket) => bucket.id)).toEqual(["short", "long"]);
  });

  it("formats reset countdowns without negative values", () => {
    expect(formatResetCountdown(3_661_000, 0)).toBe("1h 1m 1s");
    expect(formatResetCountdown(0, 1)).toBe("ready");
  });

  it("parses the locally generated rate-limit and daily-usage response shapes", async () => {
    const client = {
      sendRequest: async <T = unknown>(method: string): Promise<T> => {
        if (method === "account/rateLimits/read") {
          return {
            rateLimits: {},
            rateLimitsByLimitId: {
              codex: {
                limitName: "Codex",
                primary: { usedPercent: 20, windowDurationMins: 300, resetsAt: 2_000_000_000 },
                secondary: null,
              },
            },
          } as T;
        }
        return {
          dailyUsageBuckets: [{ startDate: new Date().toISOString().slice(0, 10), tokens: 42 }],
        } as T;
      },
    };
    const provider = new CodexUsageProvider(client);
    await expect(provider.readRateLimits()).resolves.toEqual([
      expect.objectContaining({
        id: "codex-primary",
        usedPercent: 20,
        remainingPercent: 80,
        windowDurationMins: 300,
      }),
    ]);
    await expect(provider.readDailyUsage()).resolves.toEqual(
      expect.objectContaining({ tokens: 42, source: "codex-app-server" }),
    );
  });
});
