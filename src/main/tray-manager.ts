import { app, Menu, nativeImage, Tray } from "electron";
import type { LocalSettings } from "../shared/settings";

export interface TrayActions {
  showOrHide(): void;
  toggleHud(): void;
  toggleDebug(): void;
  toggleAlwaysOnTop(): void;
  toggleClickThrough(): void;
  reconnectCodex(): void;
  connectCodexHook(): void;
}

export class TrayManager {
  #tray?: Tray;

  get isCreated(): boolean {
    return Boolean(this.#tray && !this.#tray.isDestroyed());
  }

  create(settings: LocalSettings, actions: TrayActions): Tray {
    this.#tray?.destroy();
    const svg = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#8b7cff"/><circle cx="6" cy="7" r="1" fill="#10121c"/><circle cx="10" cy="7" r="1" fill="#10121c"/></svg>',
    );
    const tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml,${svg}`));
    tray.setToolTip("Codex Pet Desktop");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show / hide pet", click: actions.showOrHide },
        { label: "Open HUD", click: actions.toggleHud },
        { label: "Open debug panel", click: actions.toggleDebug },
        { type: "separator" },
        {
          label: "Always on top",
          type: "checkbox",
          checked: settings.alwaysOnTop,
          click: actions.toggleAlwaysOnTop,
        },
        {
          label: "Click-through mode",
          type: "checkbox",
          checked: settings.clickThrough,
          click: actions.toggleClickThrough,
        },
        { label: "Connect Codex activity…", click: actions.connectCodexHook },
        { label: "Reconnect App Server", click: actions.reconnectCodex },
        { type: "separator" },
        { label: "About", click: () => app.showAboutPanel() },
        { label: "Quit", click: () => app.quit() },
      ]),
    );
    tray.on("click", actions.showOrHide);
    this.#tray = tray;
    return tray;
  }

  destroy(): void {
    this.#tray?.destroy();
    this.#tray = undefined;
  }
}
