import { join } from "node:path";

export function resolveHookReceiverPath(options: {
  isPackaged: boolean;
  resourcesPath: string;
  mainDirectory: string;
}): string {
  return options.isPackaged
    ? join(options.resourcesPath, "codex-pet-hook.cjs")
    : join(options.mainDirectory, "../hook/codex-pet-hook.cjs");
}
