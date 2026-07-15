import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import type { LocalSettings } from "../shared/settings";
import { clampWindowPosition, LocalSettingsStore } from "./position-store";

const WINDOW_SIZE = { width: 420, height: 700 };

export class WindowManager {
  readonly #settingsStore: LocalSettingsStore;
  #window?: BrowserWindow;

  constructor(settingsStore: LocalSettingsStore) {
    this.#settingsStore = settingsStore;
  }

  get window(): BrowserWindow | undefined {
    return this.#window;
  }

  async create(settings: LocalSettings): Promise<BrowserWindow> {
    if (this.#window && !this.#window.isDestroyed()) return this.#window;
    const display = settings.petPosition
      ? screen.getDisplayNearestPoint(settings.petPosition)
      : screen.getPrimaryDisplay();
    const fallback = {
      x: display.workArea.x + display.workArea.width - WINDOW_SIZE.width - 24,
      y: display.workArea.y + display.workArea.height - WINDOW_SIZE.height - 24,
    };
    const position = clampWindowPosition(
      settings.petPosition ?? fallback,
      display.workArea,
      WINDOW_SIZE,
    );
    const window = new BrowserWindow({
      ...WINDOW_SIZE,
      ...position,
      frame: false,
      transparent: true,
      resizable: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: settings.alwaysOnTop,
      hasShadow: false,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: join(__dirname, "../preload/index.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: true,
      },
    });
    this.#window = window;
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    this.setClickThrough(settings.clickThrough);
    window.on("moved", () => {
      const [x, y] = window.getPosition();
      void this.#settingsStore.patch({ petPosition: { x, y } });
    });
    window.on("closed", () => {
      if (this.#window === window) this.#window = undefined;
    });
    await window.loadFile(join(__dirname, "../renderer/index.html"));
    window.once("ready-to-show", () => window.showInactive());
    return window;
  }

  showOrHide(): void {
    if (!this.#window) return;
    if (this.#window.isVisible()) this.#window.hide();
    else this.#window.showInactive();
  }

  setAlwaysOnTop(value: boolean): void {
    this.#window?.setAlwaysOnTop(value);
  }

  setClickThrough(value: boolean): void {
    this.#window?.setIgnoreMouseEvents(value, { forward: true });
  }

  focus(): void {
    this.#window?.show();
    this.#window?.focus();
  }

  send(channel: string, value: unknown): void {
    if (this.#window && !this.#window.isDestroyed()) this.#window.webContents.send(channel, value);
  }
}
