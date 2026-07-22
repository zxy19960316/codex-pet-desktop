import type { BrowserWindowConstructorOptions } from "electron";
import { SETTINGS_IPC_CHANNELS, type SettingsSection } from "../../shared/ipc/settings-ipc";

export interface SettingsBrowserWindow {
  readonly webContents: {
    readonly id: number;
    send(channel: string, value: unknown): void;
  };
  isDestroyed(): boolean;
  show(): void;
  focus(): void;
  loadFile(path: string): Promise<void>;
  once(event: string, listener: () => void): void;
  on(event: string, listener: () => void): void;
}

export interface SettingsWindowManagerOptions {
  preloadPath: string;
  htmlPath: string;
  createWindow(options: BrowserWindowConstructorOptions): SettingsBrowserWindow;
}

export class SettingsWindowManager {
  readonly #options: SettingsWindowManagerOptions;
  #window?: SettingsBrowserWindow;

  constructor(options: SettingsWindowManagerOptions) {
    this.#options = options;
  }

  get senderId(): number | undefined {
    return this.#activeWindow()?.webContents.id;
  }

  async open(section?: SettingsSection): Promise<SettingsBrowserWindow> {
    const existing = this.#activeWindow();
    if (existing) {
      existing.show();
      existing.focus();
      if (section) existing.webContents.send(SETTINGS_IPC_CHANNELS.navigate, section);
      return existing;
    }
    const window = this.#options.createWindow({
      width: 880,
      height: 640,
      minWidth: 720,
      minHeight: 520,
      show: false,
      title: "Codex Pet Settings",
      backgroundColor: "#f4f1e8",
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.#options.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: true,
      },
    });
    this.#window = window;
    window.once("ready-to-show", () => window.show());
    window.on("closed", () => {
      if (this.#window === window) this.#window = undefined;
    });
    await window.loadFile(this.#options.htmlPath);
    if (section) window.webContents.send(SETTINGS_IPC_CHANNELS.navigate, section);
    return window;
  }

  send(channel: string, value: unknown): void {
    this.#activeWindow()?.webContents.send(channel, value);
  }

  #activeWindow(): SettingsBrowserWindow | undefined {
    if (!this.#window || this.#window.isDestroyed()) return undefined;
    return this.#window;
  }
}
