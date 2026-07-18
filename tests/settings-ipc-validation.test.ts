import { describe, expect, it, vi } from "vitest";
import {
  assertSettingsSender,
  parsePetId,
  parseSettingsPatch,
  registerSettingsIpcHandlers,
  settingsPatchToLocalSettings,
} from "../src/main/settings/settings-ipc-handlers";
import { SETTINGS_IPC_CHANNELS } from "../src/shared/ipc/settings-ipc";
import {
  SettingsWindowManager,
  type SettingsBrowserWindow,
} from "../src/main/windows/settings-window-manager";

class FakeSettingsWindow implements SettingsBrowserWindow {
  readonly webContents = { id: 42, send: vi.fn() };
  readonly show = vi.fn();
  readonly focus = vi.fn();
  readonly loadFile = vi.fn(async () => undefined);
  #destroyed = false;
  #listeners = new Map<string, () => void>();

  isDestroyed(): boolean {
    return this.#destroyed;
  }

  once(event: string, listener: () => void): void {
    this.#listeners.set(`once:${event}`, listener);
  }

  on(event: string, listener: () => void): void {
    this.#listeners.set(event, listener);
  }

  emit(event: string): void {
    this.#listeners.get(event)?.();
    this.#listeners.get(`once:${event}`)?.();
  }

  destroy(): void {
    this.#destroyed = true;
    this.emit("closed");
  }
}

describe("settings IPC validation", () => {
  it("accepts only allowlisted nested settings fields", () => {
    const patch = parseSettingsPatch({
      preferences: {
        alwaysOnTop: false,
        clickThrough: true,
        soundEnabled: true,
        quotaWarningPercent: 25,
        petDisplay: { scalePercent: 125, lockPhysicalSizeAcrossDisplays: true },
      },
      device: { useMockData: false, autoStartAppServer: true },
    });

    expect(settingsPatchToLocalSettings(patch)).toEqual({
      alwaysOnTop: false,
      clickThrough: true,
      soundEnabled: true,
      quotaWarningPercent: 25,
      scalePercent: 125,
      lockPhysicalSizeAcrossDisplays: true,
      useMockData: false,
      autoStartAppServer: true,
    });
  });

  it("rejects invalid booleans, quota values, and unknown fields", () => {
    expect(() => parseSettingsPatch({ preferences: { alwaysOnTop: "false" } })).toThrow(
      "Invalid alwaysOnTop",
    );
    expect(() => parseSettingsPatch({ preferences: { quotaWarningPercent: -1 } })).toThrow(
      "Invalid quotaWarningPercent",
    );
    expect(() => parseSettingsPatch({ preferences: { quotaWarningPercent: 101 } })).toThrow(
      "Invalid quotaWarningPercent",
    );
    expect(() => parseSettingsPatch({ preferences: { quotaWarningPercent: Number.NaN } })).toThrow(
      "Invalid quotaWarningPercent",
    );
    expect(() =>
      parseSettingsPatch({ preferences: { petDisplay: { scalePercent: Number.NaN } } }),
    ).toThrow("Invalid scalePercent");
    expect(() =>
      parseSettingsPatch({
        preferences: { petDisplay: { lockPhysicalSizeAcrossDisplays: "yes" } },
      }),
    ).toThrow("Invalid lockPhysicalSizeAcrossDisplays");
    expect(() => parseSettingsPatch({ preferences: { hidden: true } })).toThrow(
      "Unknown settings field",
    );
    expect(() => parseSettingsPatch({ device: { petPosition: { x: 0, y: 0 } } })).toThrow(
      "Unknown settings field",
    );
    expect(() => parseSettingsPatch({ credentials: { token: "secret" } })).toThrow(
      "Unknown settings partition",
    );
  });

  it("accepts calls only from the current Settings Window webContents", () => {
    expect(() => assertSettingsSender(42, 42)).not.toThrow();
    expect(() => assertSettingsSender(7, 42)).toThrow("Unauthorized Settings IPC sender");
    expect(() => assertSettingsSender(42, undefined)).toThrow("Unauthorized Settings IPC sender");
  });

  it("accepts canonical pet ids and rejects arbitrary paths or values", () => {
    expect(parsePetId("pixel-sprout-2")).toBe("pixel-sprout-2");
    expect(() => parsePetId("../pet")).toThrow("Invalid pet id");
    expect(() => parsePetId("Pixel Sprout")).toThrow("Invalid pet id");
    expect(() => parsePetId(7)).toThrow("Invalid pet id");
  });

  it("routes validated live fields immediately and rejects another window", async () => {
    const handlers = new Map<
      string,
      (event: { sender: { id: number } }, value?: unknown) => unknown
    >();
    const patchSettings = vi.fn(async () => undefined);
    registerSettingsIpcHandlers(
      {
        handle: (channel, listener) => handlers.set(channel, listener),
        removeHandler: (channel) => void handlers.delete(channel),
      },
      {
        getSnapshot: vi.fn(),
        patchSettings,
        getSettingsSenderId: () => 42,
        setActivePet: vi.fn(async () => undefined),
        importPetPackage: vi.fn(async () => undefined),
        importCodexPokePet: vi.fn(async () => undefined),
        scanCodexPokePets: vi.fn(async () => undefined),
        importDiscoveredCodexPokePet: vi.fn(async () => undefined),
        rescanPets: vi.fn(async () => undefined),
        openPetsDirectory: vi.fn(async () => undefined),
      },
    );
    const patchHandler = handlers.get(SETTINGS_IPC_CHANNELS.patch)!;

    await patchHandler(
      { sender: { id: 42 } },
      {
        preferences: {
          alwaysOnTop: false,
          clickThrough: true,
          quotaWarningPercent: 15,
        },
      },
    );
    expect(patchSettings).toHaveBeenCalledWith({
      alwaysOnTop: false,
      clickThrough: true,
      quotaWarningPercent: 15,
    });
    expect(() =>
      patchHandler({ sender: { id: 7 } }, { preferences: { alwaysOnTop: true } }),
    ).toThrow("Unauthorized Settings IPC sender");
  });

  it("routes pet management only for the current Settings sender", async () => {
    const handlers = new Map<
      string,
      (event: { sender: { id: number } }, value?: unknown) => unknown
    >();
    const actions = {
      getSnapshot: vi.fn(),
      patchSettings: vi.fn(async () => undefined),
      getSettingsSenderId: () => 42,
      setActivePet: vi.fn(async () => undefined),
      importPetPackage: vi.fn(async () => undefined),
      importCodexPokePet: vi.fn(async () => undefined),
      scanCodexPokePets: vi.fn(async () => undefined),
      importDiscoveredCodexPokePet: vi.fn(async () => undefined),
      rescanPets: vi.fn(async () => undefined),
      openPetsDirectory: vi.fn(async () => undefined),
    };
    registerSettingsIpcHandlers(
      {
        handle: (channel, listener) => handlers.set(channel, listener),
        removeHandler: (channel) => void handlers.delete(channel),
      },
      actions,
    );

    await handlers.get(SETTINGS_IPC_CHANNELS.setActivePet)!({ sender: { id: 42 } }, "pixel-sprout");
    await handlers.get(SETTINGS_IPC_CHANNELS.importPetPackage)!({ sender: { id: 42 } });
    await handlers.get(SETTINGS_IPC_CHANNELS.importCodexPokePet)!({ sender: { id: 42 } });
    await handlers.get(SETTINGS_IPC_CHANNELS.scanCodexPokePets)!({ sender: { id: 42 } });
    await handlers.get(SETTINGS_IPC_CHANNELS.importDiscoveredCodexPokePet)!(
      { sender: { id: 42 } },
      "geo-bot",
    );
    await handlers.get(SETTINGS_IPC_CHANNELS.rescanPets)!({ sender: { id: 42 } });
    await handlers.get(SETTINGS_IPC_CHANNELS.openPetsDirectory)!({ sender: { id: 42 } });
    expect(actions.setActivePet).toHaveBeenCalledWith("pixel-sprout");
    expect(actions.importPetPackage).toHaveBeenCalledOnce();
    expect(actions.importCodexPokePet).toHaveBeenCalledOnce();
    expect(actions.scanCodexPokePets).toHaveBeenCalledOnce();
    expect(actions.importDiscoveredCodexPokePet).toHaveBeenCalledWith("geo-bot");
    expect(actions.rescanPets).toHaveBeenCalledOnce();
    expect(actions.openPetsDirectory).toHaveBeenCalledOnce();
    expect(() => handlers.get(SETTINGS_IPC_CHANNELS.rescanPets)!({ sender: { id: 7 } })).toThrow(
      "Unauthorized Settings IPC sender",
    );
  });
});

describe("settings window manager", () => {
  it("reuses, shows, and focuses one secure Settings Window", async () => {
    const windows: FakeSettingsWindow[] = [];
    const options: unknown[] = [];
    const manager = new SettingsWindowManager({
      preloadPath: "C:/app/settings-preload.cjs",
      htmlPath: "C:/app/settings.html",
      createWindow: (windowOptions) => {
        options.push(windowOptions);
        const window = new FakeSettingsWindow();
        windows.push(window);
        return window;
      },
    });

    const first = await manager.open();
    const second = await manager.open("pets");

    expect(first).toBe(second);
    expect(windows).toHaveLength(1);
    expect(windows[0].show).toHaveBeenCalledTimes(1);
    expect(windows[0].focus).toHaveBeenCalledTimes(1);
    expect(windows[0].loadFile).toHaveBeenCalledWith("C:/app/settings.html");
    expect(options[0]).toMatchObject({
      show: false,
      webPreferences: {
        preload: "C:/app/settings-preload.cjs",
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    expect(manager.senderId).toBe(42);
    expect(windows[0].webContents.send).toHaveBeenCalledWith(
      SETTINGS_IPC_CHANNELS.navigate,
      "pets",
    );

    windows[0].destroy();
    await manager.open();
    expect(windows).toHaveLength(2);
  });
});
