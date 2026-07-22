import { Menu, nativeImage, Tray } from "electron";
import { buildPetMenuTemplate, type PetMenuViewModel } from "./menu/menu-view-model";
import { toElectronMenuTemplate, type PetMenuExecutor } from "./menu/pet-context-menu";

export class TrayManager {
  readonly #iconPath: string;
  #tray?: Tray;

  constructor(iconPath: string) {
    this.#iconPath = iconPath;
  }

  get isCreated(): boolean {
    return Boolean(this.#tray && !this.#tray.isDestroyed());
  }

  create(viewModel: PetMenuViewModel, execute: PetMenuExecutor): Tray {
    this.#tray?.destroy();
    const icon = nativeImage.createFromPath(this.#iconPath);
    if (icon.isEmpty()) throw new Error(`Tray icon is unavailable: ${this.#iconPath}`);
    const tray = new Tray(icon);
    tray.setToolTip("Codex Pet Desktop");
    tray.setContextMenu(
      Menu.buildFromTemplate(
        toElectronMenuTemplate(buildPetMenuTemplate(viewModel, "tray"), execute),
      ),
    );
    tray.on("click", () => execute({ type: "show-or-hide" }));
    this.#tray = tray;
    return tray;
  }

  destroy(): void {
    this.#tray?.destroy();
    this.#tray = undefined;
  }
}
