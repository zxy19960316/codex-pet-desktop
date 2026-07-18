import type { AppServerStatus } from "../../core/codex/app-server-process";
import type { DailyUsage, RateLimitBucket } from "../../core/codex/usage-provider";
import type {
  DeviceSettings,
  SettingsDocumentV2,
  SettingsLoadState,
  SettingsPreferences,
} from "../settings";

export const SETTINGS_IPC_CHANNELS = {
  getSnapshot: "settings:get-snapshot",
  snapshot: "settings:snapshot",
  patch: "settings:patch",
} as const;

export interface SettingsPatch {
  preferences?: Partial<
    Pick<
      SettingsPreferences,
      "alwaysOnTop" | "clickThrough" | "soundEnabled" | "quotaWarningPercent"
    >
  >;
  device?: Partial<Pick<DeviceSettings, "useMockData" | "autoStartAppServer">>;
}

export interface SettingsWindowSnapshot {
  settings: SettingsDocumentV2;
  loadState: SettingsLoadState;
  status: {
    connectionStatus: AppServerStatus;
    connectionDetail?: string;
    protocolSource: "codex-hooks" | "codex-app-server" | "mock" | "unavailable";
    activeThreadCount: number;
  };
  quota: {
    rateLimits: RateLimitBucket[] | null;
    dailyUsage: DailyUsage | null;
    currentThreadTokens: number | null;
  };
  app: {
    name: string;
    version: string;
  };
}

export interface SettingsApi {
  getSnapshot(): Promise<SettingsWindowSnapshot>;
  subscribe(listener: (snapshot: SettingsWindowSnapshot) => void): () => void;
  patch(patch: SettingsPatch): Promise<void>;
}
