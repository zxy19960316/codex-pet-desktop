import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Hud } from "../src/renderer/hud/Hud";
import type { DesktopSnapshot } from "../src/shared/ipc-contract";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

function snapshot(): DesktopSnapshot {
  return {
    connectionStatus: "connected",
    petState: "working",
    threadStates: [],
    activeThreadCount: 1,
    sessionOverview: {
      sessions: [
        {
          sessionId: "private-session-id",
          title: "完善桌宠会话交互",
          projectLabel: "codex-pet-desktop",
          state: "working",
          startedAt: 1,
          lastActivityAt: 2,
          sessionElapsedMs: 3_660_000,
          turnElapsedMs: 120_000,
          activeWorkMs: 180_000,
          requiresAttention: false,
          canSelect: true,
          canInterrupt: true,
          canSteer: true,
          canReviewApproval: false,
          canReply: false,
          activeTurnId: "turn-id",
        },
      ],
      attention: {
        primarySessionId: "private-session-id",
        primaryState: "working",
        concurrencyLevel: 1,
        presentationHint: "single-session",
        secondarySessions: [],
        counts: {
          active: 1,
          thinking: 0,
          working: 1,
          approvals: 0,
          waitingInputs: 0,
          errors: 0,
        },
      },
      todayActiveMs: 180_000,
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
    currentThreadTokens: 12_345,
    contextWindowTokens: 258_400,
    settings: { ...DEFAULT_SETTINGS, hudVisible: true },
    protocolSource: "codex-session-file",
  };
}

describe("detailed session Hub", () => {
  it("shows detailed normalized session information and a direct Settings action", () => {
    const markup = renderToStaticMarkup(createElement(Hud, { snapshot: snapshot() }));
    expect(markup).toContain("会话 Hub");
    expect(markup).toContain("活跃 1");
    expect(markup).toContain("完善桌宠会话交互");
    expect(markup).toContain("codex-pet-desktop");
    expect(markup).toContain("工作中");
    expect(markup).toContain("已工作 3 分钟");
    expect(markup).toContain("打开设置中心");
    expect(markup).not.toContain("private-session-id");
    expect(markup).not.toContain("turn-id");
  });
});
