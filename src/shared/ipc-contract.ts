import type { ApprovalDecision, ApprovalRequest } from "../core/codex/approval-router";
import type { AppServerStatus } from "../core/codex/app-server-process";
import type { DailyUsage, RateLimitBucket } from "../core/codex/usage-provider";
import type { PetState, PetStateChange } from "../core/pet/pet-state";
import type { LocalSettings } from "./settings";

export const IPC_CHANNELS = {
  getSnapshot: "desktop:get-snapshot",
  snapshot: "desktop:snapshot",
  setPetState: "desktop:set-pet-state",
  respondApproval: "desktop:respond-approval",
  toggleHud: "desktop:toggle-hud",
  toggleDebug: "desktop:toggle-debug",
  toggleAlwaysOnTop: "desktop:toggle-always-on-top",
  toggleClickThrough: "desktop:toggle-click-through",
  reconnectCodex: "desktop:reconnect-codex",
  patchSettings: "desktop:patch-settings",
  enqueueMockApproval: "desktop:enqueue-mock-approval",
  quit: "desktop:quit",
} as const;

export interface DesktopSnapshot {
  connectionStatus: AppServerStatus;
  connectionDetail?: string;
  petState: PetState;
  threadStates: PetStateChange[];
  activeThreadCount: number;
  currentCwd?: string;
  approvals: ApprovalRequest[];
  rateLimits: RateLimitBucket[] | null;
  dailyUsage: DailyUsage | null;
  currentThreadTokens: number | null;
  settings: LocalSettings;
  protocolSource: "codex-app-server" | "mock" | "unavailable";
}

export interface DesktopApi {
  getSnapshot(): Promise<DesktopSnapshot>;
  subscribe(listener: (snapshot: DesktopSnapshot) => void): () => void;
  setPetState(state: PetState): Promise<void>;
  respondApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
  toggleHud(): Promise<void>;
  toggleDebug(): Promise<void>;
  toggleAlwaysOnTop(): Promise<void>;
  toggleClickThrough(): Promise<void>;
  reconnectCodex(): Promise<void>;
  patchSettings(patch: Partial<LocalSettings>): Promise<void>;
  enqueueMockApproval(): Promise<void>;
  quit(): Promise<void>;
}
