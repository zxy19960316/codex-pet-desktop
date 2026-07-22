import { BrowserWindow, screen, type Rectangle } from "electron";
import { join } from "node:path";
import type { PetPackage } from "../core/pet/pet-manifest";
import type { LocalSettings } from "../shared/settings";
import type { WindowShapeRequest } from "../shared/ipc-contract";
import { computePetWindowBounds } from "./pet-window-layout";
import { buildRenderedWindowShape } from "./pet-window-shape";
import { initialWindowMode, type WindowMode } from "./window-layout";

export interface PositionSettingsStore {
  patch(patch: Partial<LocalSettings>): Promise<LocalSettings>;
}

interface PetFrame {
  width: number;
  height: number;
}

const DEFAULT_FRAME: PetFrame = { width: 64, height: 64 };
const CAPTURE_MARGIN = 8;

function captureRectangle(
  rectangle: WindowShapeRequest["spriteRect"],
  contentBounds: Pick<Rectangle, "width" | "height">,
): Rectangle {
  const left = Math.max(0, Math.floor(rectangle.x - CAPTURE_MARGIN));
  const top = Math.max(0, Math.floor(rectangle.y - CAPTURE_MARGIN));
  const right = Math.min(
    contentBounds.width,
    Math.ceil(rectangle.x + rectangle.width + CAPTURE_MARGIN),
  );
  const bottom = Math.min(
    contentBounds.height,
    Math.ceil(rectangle.y + rectangle.height + CAPTURE_MARGIN),
  );
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

function activeFrame(pet: PetPackage | undefined): PetFrame {
  const animation = pet?.animations.idle ?? Object.values(pet?.animations ?? {})[0];
  return animation
    ? { width: animation.frameWidth, height: animation.frameHeight }
    : { ...DEFAULT_FRAME };
}

export class WindowManager {
  readonly #settingsStore: PositionSettingsStore;
  #window?: BrowserWindow;
  #mode: WindowMode = "compact";
  #settings?: LocalSettings;
  #frame: PetFrame = { ...DEFAULT_FRAME };
  #physicalScaleFactor = 1;
  #applyingBounds = false;
  #shapeGeneration = 0;
  #hasSpriteShape = false;

  constructor(settingsStore: PositionSettingsStore) {
    this.#settingsStore = settingsStore;
  }

  get window(): BrowserWindow | undefined {
    return this.#window;
  }

  get physicalScaleFactor(): number {
    return this.#physicalScaleFactor;
  }

  async create(settings: LocalSettings): Promise<BrowserWindow> {
    if (this.#window && !this.#window.isDestroyed()) return this.#window;
    this.#settings = { ...settings };
    this.#mode = initialWindowMode(settings);
    const display = settings.petPosition
      ? screen.getDisplayNearestPoint(settings.petPosition)
      : screen.getPrimaryDisplay();
    const initial = computePetWindowBounds({
      frameWidth: this.#frame.width,
      frameHeight: this.#frame.height,
      scalePercent: settings.scalePercent,
      physicalScaleFactor: this.#physicalFactor(display.scaleFactor),
      expanded: this.#mode === "expanded",
      currentBounds: settings.petPosition
        ? { ...settings.petPosition, width: 300, height: 360 }
        : {
            x: display.workArea.x + display.workArea.width - 324,
            y: display.workArea.y + display.workArea.height - 384,
            width: 300,
            height: 360,
          },
      displayWorkArea: display.workArea,
      anchor: settings.petPosition ? undefined : "right-bottom",
    });
    this.#physicalScaleFactor = this.#physicalFactor(display.scaleFactor);
    const window = new BrowserWindow({
      ...initial,
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
      if (this.#applyingBounds) return;
      const [x, y] = window.getPosition();
      void this.#settingsStore.patch({ petPosition: { x, y } });
      this.#relayout();
    });
    window.on("closed", () => {
      if (this.#window === window) this.#window = undefined;
    });
    await window.loadFile(join(__dirname, "../renderer/index.html"));
    window.once("ready-to-show", () => window.showInactive());
    return window;
  }

  setPetPackage(pet: PetPackage | undefined): void {
    this.#frame = activeFrame(pet);
    this.#relayout();
  }

  updatePetDisplay(settings: LocalSettings): void {
    this.#settings = { ...settings };
    this.#relayout();
  }

  setMode(mode: WindowMode): void {
    if (mode === this.#mode) return;
    this.#mode = mode;
    this.#relayout();
  }

  #physicalFactor(displayScaleFactor: number): number {
    if (!this.#settings?.lockPhysicalSizeAcrossDisplays) return 1;
    const primaryScaleFactor = screen.getPrimaryDisplay().scaleFactor;
    if (!Number.isFinite(displayScaleFactor) || displayScaleFactor <= 0) return 1;
    return primaryScaleFactor / displayScaleFactor;
  }

  #relayout(): void {
    const window = this.#window;
    const settings = this.#settings;
    if (!window || window.isDestroyed() || !settings || this.#applyingBounds) return;
    const current = window.getBounds();
    const display = screen.getDisplayNearestPoint({
      x: current.x + Math.round(current.width / 2),
      y: current.y + Math.round(current.height / 2),
    });
    const physicalScaleFactor = this.#physicalFactor(display.scaleFactor);
    const next = computePetWindowBounds({
      frameWidth: this.#frame.width,
      frameHeight: this.#frame.height,
      scalePercent: settings.scalePercent,
      physicalScaleFactor,
      expanded: this.#mode === "expanded",
      currentBounds: current,
      displayWorkArea: display.workArea,
    });
    this.#physicalScaleFactor = physicalScaleFactor;
    if (
      next.x === current.x &&
      next.y === current.y &&
      next.width === current.width &&
      next.height === current.height
    )
      return;
    this.#applyingBounds = true;
    window.setBounds(next, true);
    setTimeout(() => {
      this.#applyingBounds = false;
    }, 50);
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

  updateWindowShape(request: WindowShapeRequest): void {
    const window = this.#window;
    if (!window || window.isDestroyed() || !["win32", "linux"].includes(process.platform)) return;
    const generation = ++this.#shapeGeneration;
    const fallbackShape = [request.spriteRect, ...request.uiRects].map((rectangle) => ({
      x: Math.floor(rectangle.x),
      y: Math.floor(rectangle.y),
      width: Math.max(1, Math.ceil(rectangle.x + rectangle.width) - Math.floor(rectangle.x)),
      height: Math.max(1, Math.ceil(rectangle.y + rectangle.height) - Math.floor(rectangle.y)),
    }));
    if (!this.#hasSpriteShape) {
      window.setShape(fallbackShape);
      this.#hasSpriteShape = true;
    }
    const captureRect = captureRectangle(request.spriteRect, window.getContentBounds());
    void window.webContents
      .capturePage(captureRect)
      .then((image) => {
        if (generation !== this.#shapeGeneration || window.isDestroyed()) return;
        const size = image.getSize();
        if (image.isEmpty() || size.width <= 0 || size.height <= 0) {
          window.setShape(fallbackShape);
          return;
        }
        window.setShape(
          buildRenderedWindowShape({
            bitmap: { width: size.width, height: size.height, pixels: image.toBitmap() },
            captureRect,
            spriteFallbackRect: request.spriteRect,
            uiRects: request.uiRects,
          }),
        );
      })
      .catch(() => {
        if (generation === this.#shapeGeneration && !window.isDestroyed())
          window.setShape(fallbackShape);
      });
  }

  focus(): void {
    this.#window?.show();
    this.#window?.focus();
  }

  send(channel: string, value: unknown): void {
    if (this.#window && !this.#window.isDestroyed()) this.#window.webContents.send(channel, value);
  }
}
