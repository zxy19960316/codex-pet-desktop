import type { DesktopSnapshot } from "../shared/ipc-contract";
import type { LocalSettings } from "../shared/settings";

export const WINDOW_SIZES = {
  compact: { width: 240, height: 316 },
  expanded: { width: 420, height: 700 },
} as const;

export type WindowMode = keyof typeof WINDOW_SIZES;

export function initialWindowMode(settings: LocalSettings): WindowMode {
  return settings.hudVisible || settings.debugVisible ? "expanded" : "compact";
}

export function windowModeForSnapshot(snapshot: DesktopSnapshot): WindowMode {
  const needsResponse = snapshot.approvals.length > 0 || snapshot.userInputs.length > 0;
  return snapshot.settings.hudVisible || snapshot.settings.debugVisible || needsResponse
    ? "expanded"
    : "compact";
}
