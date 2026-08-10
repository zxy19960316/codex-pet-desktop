import { describe, expect, it } from "vitest";
import type { DesktopSessionSummary, DesktopSnapshot } from "../src/shared/ipc-contract";
import {
  buildSessionPresentation,
  formatSessionDuration,
  sessionStateLabel,
} from "../src/renderer/sessions/session-view-model";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

function session(
  sessionId: string,
  title: string,
  overrides: Partial<DesktopSessionSummary> = {},
): DesktopSessionSummary {
  return {
    sessionId,
    title,
    state: "idle",
    startedAt: 1_000,
    lastActivityAt: 2_000,
    sessionElapsedMs: 1_000,
    activeWorkMs: 0,
    requiresAttention: false,
    canSelect: false,
    canInterrupt: false,
    canSteer: false,
    canReviewApproval: false,
    canReply: false,
    ...overrides,
  };
}

function snapshot(sessions: DesktopSessionSummary[]): DesktopSnapshot {
  return {
    connectionStatus: "connected",
    petState: "working",
    threadStates: [],
    activeThreadCount: 2,
    sessionOverview: {
      sessions,
      attention: {
        primaryState: "working",
        concurrencyLevel: 2,
        presentationHint: "multi-session",
        secondarySessions: [],
        counts: {
          active: 2,
          thinking: 0,
          working: 1,
          approvals: 1,
          waitingInputs: 0,
          errors: 0,
        },
      },
      todayActiveMs: 3_660_000,
    },
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
    settings: { ...DEFAULT_SETTINGS },
    protocolSource: "codex-session-file",
  };
}

describe("session UI view model", () => {
  it("prioritizes attention, then active work, then recent sessions", () => {
    const result = buildSessionPresentation(
      snapshot([
        session("idle", "较早的待机会话", { lastActivityAt: 300 }),
        session("done", "最近完成的任务", {
          state: "success",
          lastActivityAt: 500,
          sessionElapsedMs: 125_000,
        }),
        session("work", "正在实现会话 Hub", {
          state: "working",
          lastActivityAt: 400,
          activeWorkMs: 61_000,
          canSelect: true,
        }),
        session("approval", "需要确认的任务", {
          state: "approval",
          lastActivityAt: 100,
          requiresAttention: true,
          canReviewApproval: true,
        }),
      ]),
      3,
    );

    expect(result).toMatchObject({
      totalCount: 4,
      activeCount: 2,
      todayActiveLabel: "1 小时 1 分钟",
      items: [
        { sessionId: "approval", title: "需要确认的任务", stateLabel: "等待确认" },
        {
          sessionId: "work",
          title: "正在实现会话 Hub",
          stateLabel: "工作中",
          activeWorkLabel: "1 分钟",
        },
        { sessionId: "done", title: "最近完成的任务", stateLabel: "已完成" },
      ],
    });
  });

  it("formats bounded Chinese durations without inventing unavailable precision", () => {
    expect(formatSessionDuration(Number.NaN)).toBe("<1 分钟");
    expect(formatSessionDuration(-10)).toBe("<1 分钟");
    expect(formatSessionDuration(59_999)).toBe("<1 分钟");
    expect(formatSessionDuration(60_000)).toBe("1 分钟");
    expect(formatSessionDuration(3_660_000)).toBe("1 小时 1 分钟");
  });

  it("provides an exhaustive Chinese label for every normalized session state", () => {
    expect(
      [
        "idle",
        "thinking",
        "working",
        "approval",
        "waiting_input",
        "success",
        "error",
        "interrupted",
        "offline",
        "closed",
      ].map((state) => sessionStateLabel(state as DesktopSessionSummary["state"])),
    ).toEqual([
      "待机",
      "思考中",
      "工作中",
      "等待确认",
      "等待输入",
      "已完成",
      "出错",
      "已中断",
      "离线",
      "已关闭",
    ]);
  });

  it("returns a stable empty presentation when session intelligence is unavailable", () => {
    const value = snapshot([]);
    delete value.sessionOverview;
    value.activeThreadCount = 0;
    expect(buildSessionPresentation(value, 3)).toEqual({
      totalCount: 0,
      activeCount: 0,
      todayActiveLabel: "<1 分钟",
      items: [],
    });
  });
});
