import { join } from "node:path";

export function resolveTrayIconPath(options: {
  isPackaged: boolean;
  resourcesPath: string;
  projectDirectory: string;
}): string {
  return options.isPackaged
    ? join(options.resourcesPath, "tray-icon.png")
    : join(options.projectDirectory, "build", "generated", "tray-icon.png");
}
