import type { AppServerStatus } from "../../core/codex/app-server-process";
import type { DailyUsage, RateLimitBucket } from "../../core/codex/usage-provider";
import type {
  DeviceSettings,
  SettingsDocumentV2,
  SettingsLoadState,
  SettingsPreferences,
} from "../settings";
import type { PetRegistrySnapshot } from "../../core/pet/pet-manifest";
import type { CodexPokePetsDiscoverySnapshot } from "../../core/pet/adapters/codex-pokepets-types";

export const SETTINGS_IPC_CHANNELS = {
  getSnapshot: "settings:get-snapshot",
  snapshot: "settings:snapshot",
  patch: "settings:patch",
  setActivePet: "settings:pet:set-active",
  importPetPackage: "settings:pet:import",
  importCodexPokePet: "settings:pet:import-codex-pokepet",
  scanCodexPokePets: "settings:pet:scan-codex-pokepets",
  importDiscoveredCodexPokePet: "settings:pet:import-discovered-codex-pokepet",
  rescanPets: "settings:pet:rescan",
  openPetsDirectory: "settings:pet:open-directory",
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
  pets: PetRegistrySnapshot;
  codexPokePets: CodexPokePetsDiscoverySnapshot;
}

export interface SettingsApi {
  getSnapshot(): Promise<SettingsWindowSnapshot>;
  subscribe(listener: (snapshot: SettingsWindowSnapshot) => void): () => void;
  patch(patch: SettingsPatch): Promise<void>;
  setActivePet(id: string): Promise<void>;
  importPetPackage(): Promise<void>;
  importCodexPokePet(): Promise<void>;
  scanCodexPokePets(): Promise<void>;
  importDiscoveredCodexPokePet(sourcePetId: string): Promise<void>;
  rescanPets(): Promise<void>;
  openPetsDirectory(): Promise<void>;
}
