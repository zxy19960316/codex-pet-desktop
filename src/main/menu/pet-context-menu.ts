import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from "electron";
import {
  buildPetMenuTemplate,
  type PetMenuAction,
  type PetMenuItem,
  type PetMenuViewModel,
} from "./menu-view-model";

export type PetMenuExecutor = (action: PetMenuAction) => void;

export function toElectronMenuTemplate(
  items: PetMenuItem[],
  execute: PetMenuExecutor,
): MenuItemConstructorOptions[] {
  return items.map((item) => ({
    label: item.label,
    type: item.type,
    enabled: item.enabled,
    checked: item.checked,
    submenu: item.submenu ? toElectronMenuTemplate(item.submenu, execute) : undefined,
    click: item.action ? () => execute(item.action!) : undefined,
  }));
}

export class PetContextMenu {
  attach(
    window: BrowserWindow,
    getViewModel: () => PetMenuViewModel,
    execute: PetMenuExecutor,
  ): void {
    window.webContents.on("context-menu", () => {
      const template = buildPetMenuTemplate(getViewModel(), "pet");
      Menu.buildFromTemplate(toElectronMenuTemplate(template, execute)).popup({ window });
    });
  }
}
