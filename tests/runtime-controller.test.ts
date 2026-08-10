import { describe, expect, it, vi } from "vitest";
import type { AppServerProcessOptions } from "../src/core/codex/app-server-process";
import { SafeLogger } from "../src/core/logging/logger";
import {
  LOCAL_SESSION_ACTIVITY_TIMEOUT_MS,
  RuntimeController,
  TERMINAL_PET_STATE_MS,
} from "../src/main/runtime-controller";
import { DEFAULT_SETTINGS } from "../src/shared/settings";
import type { SessionObservation } from "../src/core/sessions/session-types";

describe("RuntimeController", () => {
  it("allowlists pet display settings and publishes their persisted values", async () => {
    const persistSettings = vi.fn(async (patch) => ({ ...DEFAULT_SETTINGS, ...patch }));
    const controller = new RuntimeController({
      logger: new SafeLogger(),
      initialSettings: { ...DEFAULT_SETTINGS },
      publish: vi.fn(),
      persistSettings,
    });
    await controller.patchSettings({
      scalePercent: 175,
      lockPhysicalSizeAcrossDisplays: true,
      petPosition: { x: 1, y: 2 },
    });
    expect(persistSettings).toHaveBeenCalledWith({
      scalePercent: 175,
      lockPhysicalSizeAcrossDisplays: true,
    });
    expect(controller.getSnapshot().settings).toMatchObject({
      scalePercent: 175,
      lockPhysicalSizeAcrossDisplays: true,
    });
  });

  it("publishes isolated thread token usage and cleans it when a thread closes", async () => {
    let appServerOptions: AppServerProcessOptions | undefined;
    const appServer = {
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      reconnect: vi.fn(),
    };
    const publish = vi.fn();
    const controller = new RuntimeController({
      logger: new SafeLogger(),
      initialSettings: { ...DEFAULT_SETTINGS, autoStartAppServer: false },
      publish,
      createAppServer: (options) => {
        appServerOptions = options;
        return appServer as never;
      },
    });
    await controller.start();
    appServerOptions?.onNotification?.("thread/tokenUsage/updated", {
      threadId: "a",
      turnId: "turn-a",
      tokenUsage: {
        total: {
          totalTokens: 11,
          inputTokens: 5,
          cachedInputTokens: 1,
          outputTokens: 5,
          reasoningOutputTokens: 0,
        },
      },
    });
    appServerOptions?.onNotification?.("thread/tokenUsage/updated", {
      threadId: "b",
      turnId: "turn-b",
      tokenUsage: {
        total: {
          totalTokens: 22,
          inputTokens: 10,
          cachedInputTokens: 2,
          outputTokens: 10,
          reasoningOutputTokens: 0,
        },
      },
    });
    expect(controller.getSnapshot().threadTokenUsage.map((usage) => usage.threadId)).toEqual([
      "a",
      "b",
    ]);
    expect(controller.getSnapshot().currentThreadTokens).toBe(22);
    controller.setSelectedThreadId("a");
    expect(controller.getSnapshot().currentThreadTokens).toBe(11);
    appServerOptions?.onNotification?.("thread/closed", { threadId: "a" });
    expect(controller.getSnapshot().threadTokenUsage.map((usage) => usage.threadId)).toEqual(["b"]);
    expect(publish).toHaveBeenCalled();
  });

  it("cleans request and transient pet state for error, stopped, and reconnecting status", async () => {
    let appServerOptions: AppServerProcessOptions | undefined;
    const controller = new RuntimeController({
      logger: new SafeLogger(),
      initialSettings: { ...DEFAULT_SETTINGS, autoStartAppServer: false },
      publish: () => undefined,
      createAppServer: (options) => {
        appServerOptions = options;
        return {
          start: vi.fn(),
          stop: vi.fn().mockResolvedValue(undefined),
          reconnect: vi.fn(),
        } as never;
      },
    });
    await controller.start();
    controller.enqueueMockUserInput();
    expect(controller.getSnapshot()).toMatchObject({
      petState: "waiting_input",
      userInputs: [{ isMock: true }],
    });
    appServerOptions?.onStatus?.("error", "test disconnect");
    expect(controller.getSnapshot().userInputs).toEqual([]);
    controller.enqueueMockUserInput();
    appServerOptions?.onStatus?.("stopped", "test stopped");
    expect(controller.getSnapshot().userInputs).toEqual([]);
    controller.enqueueMockUserInput();
    controller.setDebugPetState("working");
    appServerOptions?.onStatus?.("reconnecting", "test reconnect");
    expect(controller.getSnapshot()).toMatchObject({
      petState: "idle",
      approvals: [],
      userInputs: [],
    });
  });

  it("follows local Codex task work and returns to idle after the terminal animation", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-09T14:00:00.000Z"));
      const publish = vi.fn();
      const controller = new RuntimeController({
        logger: new SafeLogger(),
        initialSettings: { ...DEFAULT_SETTINGS, autoStartAppServer: false },
        publish,
      });
      const observe = (
        timestamp: number,
        fields: Pick<SessionObservation, "event" | "state">,
      ): SessionObservation => ({
        providerId: "codex",
        sessionId: "local-session",
        source: "codex-session-file",
        timestamp,
        turnId: "local-turn",
        ...fields,
      });

      controller.applySessionObservations([
        observe(Date.now(), { event: "session_started" }),
        observe(Date.now() + 1, { event: "turn_started", state: "working" }),
      ]);
      expect(controller.getSnapshot()).toMatchObject({
        petState: "working",
        activeThreadCount: 1,
        protocolSource: "codex-session-file",
      });

      controller.applySessionObservations([
        observe(Date.now() + 2, { event: "state_changed", state: "thinking" }),
      ]);
      expect(controller.getSnapshot().petState).toBe("thinking");

      controller.applySessionObservations([
        observe(Date.now() + 3, { event: "state_changed", state: "working" }),
      ]);
      expect(controller.getSnapshot().petState).toBe("working");

      controller.applySessionObservations([
        observe(Date.now() + 4, { event: "turn_completed", state: "success" }),
      ]);
      expect(controller.getSnapshot()).toMatchObject({
        petState: "success",
        activeThreadCount: 0,
      });

      vi.advanceTimersByTime(TERMINAL_PET_STATE_MS + 5);
      expect(controller.getSnapshot()).toMatchObject({
        petState: "idle",
        activeThreadCount: 0,
      });
      expect(publish).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores local session-file observations while mock data is enabled", () => {
    const controller = new RuntimeController({
      logger: new SafeLogger(),
      initialSettings: { ...DEFAULT_SETTINGS, useMockData: true, autoStartAppServer: false },
      publish: vi.fn(),
    });
    controller.applySessionObservations([
      {
        providerId: "codex",
        sessionId: "ignored-session",
        source: "codex-session-file",
        timestamp: Date.now(),
        event: "turn_started",
        state: "working",
      },
    ]);
    const snapshot = controller.getSnapshot();
    expect(snapshot).toMatchObject({
      activeThreadCount: 0,
      protocolSource: "unavailable",
    });
    expect(snapshot.petState).not.toBe("working");
  });

  it("does not revive an abandoned local task from an old session tail", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-09T15:00:00.000Z"));
      const controller = new RuntimeController({
        logger: new SafeLogger(),
        initialSettings: { ...DEFAULT_SETTINGS, autoStartAppServer: false },
        publish: vi.fn(),
      });
      controller.applySessionObservations([
        {
          providerId: "codex",
          sessionId: "abandoned-session",
          source: "codex-session-file",
          timestamp: Date.now() - LOCAL_SESSION_ACTIVITY_TIMEOUT_MS - 1,
          event: "turn_started",
          state: "working",
        },
      ]);

      expect(controller.getSnapshot()).toMatchObject({
        petState: "idle",
        activeThreadCount: 0,
        protocolSource: "codex-session-file",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns a silent local task to idle after the activity timeout", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-09T16:00:00.000Z"));
      const controller = new RuntimeController({
        logger: new SafeLogger(),
        initialSettings: { ...DEFAULT_SETTINGS, autoStartAppServer: false },
        publish: vi.fn(),
      });
      controller.applySessionObservations([
        {
          providerId: "codex",
          sessionId: "silent-session",
          source: "codex-session-file",
          timestamp: Date.now(),
          event: "turn_started",
          state: "working",
        },
      ]);
      expect(controller.getSnapshot().petState).toBe("working");

      vi.advanceTimersByTime(LOCAL_SESSION_ACTIVITY_TIMEOUT_MS + 1);
      expect(controller.getSnapshot()).toMatchObject({
        petState: "idle",
        activeThreadCount: 0,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
