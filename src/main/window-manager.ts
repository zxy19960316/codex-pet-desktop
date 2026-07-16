import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import type { LocalSettings } from "../shared/settings";
import { clampWindowPosition, LocalSettingsStore } from "./position-store";
import { initialWindowMode, WINDOW_SIZES, type WindowMode } from "./window-layout";

export class WindowManager {
  readonly #settingsStore: LocalSettingsStore;
  #window?: BrowserWindow;
  #mode: WindowMode = "compact";

  constructor(settingsStore: LocalSettingsStore) {
    this.#settingsStore = settingsStore;
  }

  get window(): BrowserWindow | undefined {
    return this.#window;
  }

  async create(settings: LocalSettings): Promise<BrowserWindow> {
    if (this.#window && !this.#window.isDestroyed()) return this.#window;
    this.#mode = initialWindowMode(settings);
    const windowSize = WINDOW_SIZES[this.#mode];
    const display = settings.petPosition
      ? screen.getDisplayNearestPoint(settings.petPosition)
      : screen.getPrimaryDisplay();
    const fallback = {
      x: display.workArea.x + display.workArea.width - windowSize.width - 24,
      y: display.workArea.y + display.workArea.height - windowSize.height - 24,
    };
    const position = clampWindowPosition(
      settings.petPosition ?? fallback,
      display.workArea,
      windowSize,
    );
    const window = new BrowserWindow({
      ...windowSize,
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

  setMode(mode: WindowMode): void {
    const window = this.#window;
    if (!window || window.isDestroyed() || mode === this.#mode) return;
    const current = window.getBounds();
    const nextSize = WINDOW_SIZES[mode];
    const display = screen.getDisplayNearestPoint({ x: current.x, y: current.y });
    const anchoredPosition = {
      x: current.x + current.width - nextSize.width,
      y: current.y + current.height - nextSize.height,
    };
    const position = clampWindowPosition(anchoredPosition, display.workArea, nextSize);
    this.#mode = mode;
    window.setBounds({ ...nextSize, ...position }, true);
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
