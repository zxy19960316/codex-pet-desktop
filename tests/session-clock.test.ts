import { describe, expect, it } from "vitest";
import {
  accumulateActiveWork,
  sessionElapsedMs,
  turnElapsedMs,
  unionActiveIntervals,
} from "../src/core/sessions/session-clock";

describe("session clock", () => {
  it("clamps elapsed values and each observation interval", () => {
    expect(sessionElapsedMs(100, 50)).toBe(0);
    expect(turnElapsedMs(100, undefined, 200)).toBeUndefined();
    expect(accumulateActiveWork(10, "working", 100, 100_000)).toBe(90_010);
    expect(accumulateActiveWork(10, "idle", 100, 200)).toBe(10);
    expect(accumulateActiveWork(10, "working", 4_000, 100)).toBe(10);
  });

  it("uses the union rather than sum for concurrent daily activity", () => {
    expect(
      unionActiveIntervals([
        { start: 0, end: 600_000 },
        { start: 240_000, end: 600_000 },
      ]),
    ).toBe(600_000);
  });
});
