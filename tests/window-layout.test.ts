import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/settings";
import { initialWindowMode, WINDOW_SIZES, windowModeForSnapshot } from "../src/main/window-layout";
import type { DesktopSnapshot } from "../src/shared/ipc-contract";

function snapshot(overrides: Partial<DesktopSnapshot> = {}): DesktopSnapshot {
  return {
    connectionStatus: "connected",
    petState: "idle",
    threadStates: [],
    activeThreadCount: 0,
    currentCwdLabel: "Project root",
    approvals: [],
    userInputs: [],
    rateLimits: null,
    dailyUsage: null,
    threadTokenUsage: [],
    threads: [],
    e2eRecords: [],
    e2eSteps: [],
    currentThreadTokens: null,
    settings: { ...DEFAULT_SETTINGS, hudVisible: false },
    protocolSource: "codex-app-server",
    ...overrides,
  };
}

describe("desktop window layout", () => {
  it("starts as a compact pet when details are closed", () => {
    expect(initialWindowMode({ ...DEFAULT_SETTINGS, hudVisible: false })).toBe("compact");
    expect(WINDOW_SIZES.compact).toEqual({ width: 300, height: 360 });
  });

  it("expands for details and requests that need a response", () => {
    expect(windowModeForSnapshot(snapshot())).toBe("compact");
    expect(
      windowModeForSnapshot(snapshot({ settings: { ...DEFAULT_SETTINGS, hudVisible: true } })),
    ).toBe("expanded");
    expect(
      windowModeForSnapshot(
        snapshot({ approvals: [{ requestId: "approval" }] as DesktopSnapshot["approvals"] }),
      ),
    ).toBe("expanded");
  });
});
