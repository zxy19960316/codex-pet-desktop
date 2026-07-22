import { describe, expect, it, vi } from "vitest";
import type { AppServerProcessOptions } from "../src/core/codex/app-server-process";
import { SafeLogger } from "../src/core/logging/logger";
import { RuntimeController } from "../src/main/runtime-controller";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

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
});
