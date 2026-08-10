import type { BrowserWindow, MenuItemConstructorOptions } from "electron";
import { type PetMenuAction, type PetMenuItem } from "./menu-view-model";

export type PetMenuExecutor = (action: PetMenuAction) => void;
export const PET_CONTEXT_ACTION: PetMenuAction = { type: "open-status" };

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
  attach(window: BrowserWindow, execute: PetMenuExecutor): void {
    window.webContents.on("context-menu", () => execute(PET_CONTEXT_ACTION));
  }
}
