import { Menu, nativeImage, Tray } from "electron";
import { buildPetMenuTemplate, type PetMenuViewModel } from "./menu/menu-view-model";
import { toElectronMenuTemplate, type PetMenuExecutor } from "./menu/pet-context-menu";

export class TrayManager {
  #tray?: Tray;

  get isCreated(): boolean {
    return Boolean(this.#tray && !this.#tray.isDestroyed());
  }

  create(viewModel: PetMenuViewModel, execute: PetMenuExecutor): Tray {
    this.#tray?.destroy();
    const svg = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#8b7cff"/><circle cx="6" cy="7" r="1" fill="#10121c"/><circle cx="10" cy="7" r="1" fill="#10121c"/></svg>',
    );
    const tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml,${svg}`));
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
