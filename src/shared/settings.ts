export interface WindowPosition {
  x: number;
  y: number;
}

export interface PetDisplaySettings {
  scalePercent: number;
  lockPhysicalSizeAcrossDisplays: boolean;
}

export interface LocalSettings {
  layoutVersion: number;
  petPosition?: WindowPosition;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  hudVisible: boolean;
  debugVisible: boolean;
  useMockData: boolean;
  autoStartAppServer: boolean;
  soundEnabled: boolean;
  quotaWarningPercent: number;
  scalePercent: number;
  lockPhysicalSizeAcrossDisplays: boolean;
}

export interface SettingsPreferencesV2 {
  alwaysOnTop: boolean;
  clickThrough: boolean;
  soundEnabled: boolean;
  quotaWarningPercent: number;
}

export interface SettingsPreferences extends SettingsPreferencesV2 {
  petDisplay: PetDisplaySettings;
}

export interface DeviceSettings {
  layoutVersion: number;
  petPosition?: WindowPosition;
  hudVisible: boolean;
  debugVisible: boolean;
  useMockData: boolean;
  autoStartAppServer: boolean;
}

export interface SettingsDocumentV2 {
  schemaVersion: 2;
  preferences: SettingsPreferencesV2;
  device: DeviceSettings;
}

export interface SettingsDocumentV3 {
  schemaVersion: 3;
  preferences: SettingsPreferences;
  device: DeviceSettings;
}

export type SettingsLoadState =
  | { kind: "missing" }
  | { kind: "loaded"; schemaVersion: 3 }
  | { kind: "migrated"; sourceVersion: 1 | 2 }
  | { kind: "corrupt" }
  | { kind: "future-version"; schemaVersion: number };

export const PET_SCALE_MIN = 50;
export const PET_SCALE_MAX = 200;
export const PET_SCALE_STEP = 5;

export function clampPetScale(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(PET_SCALE_MAX, Math.max(PET_SCALE_MIN, Math.round(value)));
}

export const DEFAULT_SETTINGS: Readonly<LocalSettings> = {
  layoutVersion: 1,
  alwaysOnTop: true,
  clickThrough: false,
  hudVisible: false,
  debugVisible: false,
  useMockData: false,
  autoStartAppServer: false,
  soundEnabled: false,
  quotaWarningPercent: 20,
  scalePercent: 100,
  lockPhysicalSizeAcrossDisplays: false,
};

export const DEFAULT_SETTINGS_DOCUMENT: Readonly<SettingsDocumentV3> = {
  schemaVersion: 3,
  preferences: {
    alwaysOnTop: DEFAULT_SETTINGS.alwaysOnTop,
    clickThrough: DEFAULT_SETTINGS.clickThrough,
    soundEnabled: DEFAULT_SETTINGS.soundEnabled,
    quotaWarningPercent: DEFAULT_SETTINGS.quotaWarningPercent,
    petDisplay: {
      scalePercent: DEFAULT_SETTINGS.scalePercent,
      lockPhysicalSizeAcrossDisplays: DEFAULT_SETTINGS.lockPhysicalSizeAcrossDisplays,
    },
  },
  device: {
    layoutVersion: DEFAULT_SETTINGS.layoutVersion,
    hudVisible: DEFAULT_SETTINGS.hudVisible,
    debugVisible: DEFAULT_SETTINGS.debugVisible,
    useMockData: DEFAULT_SETTINGS.useMockData,
    autoStartAppServer: DEFAULT_SETTINGS.autoStartAppServer,
  },
};

export function cloneSettingsDocument(
  document: Readonly<SettingsDocumentV3> = DEFAULT_SETTINGS_DOCUMENT,
): SettingsDocumentV3 {
  return {
    schemaVersion: 3,
    preferences: {
      ...document.preferences,
      petDisplay: { ...document.preferences.petDisplay },
    },
    device: {
      ...document.device,
      petPosition: document.device.petPosition ? { ...document.device.petPosition } : undefined,
    },
  };
}

export function localSettingsFromDocument(document: SettingsDocumentV3): LocalSettings {
  return {
    alwaysOnTop: document.preferences.alwaysOnTop,
    clickThrough: document.preferences.clickThrough,
    soundEnabled: document.preferences.soundEnabled,
    quotaWarningPercent: document.preferences.quotaWarningPercent,
    scalePercent: document.preferences.petDisplay.scalePercent,
    lockPhysicalSizeAcrossDisplays: document.preferences.petDisplay.lockPhysicalSizeAcrossDisplays,
    ...document.device,
    petPosition: document.device.petPosition ? { ...document.device.petPosition } : undefined,
  };
}

export function settingsDocumentFromLocalSettings(settings: LocalSettings): SettingsDocumentV3 {
  return {
    schemaVersion: 3,
    preferences: {
      alwaysOnTop: settings.alwaysOnTop,
      clickThrough: settings.clickThrough,
      soundEnabled: settings.soundEnabled,
      quotaWarningPercent: settings.quotaWarningPercent,
      petDisplay: {
        scalePercent: clampPetScale(settings.scalePercent),
        lockPhysicalSizeAcrossDisplays: settings.lockPhysicalSizeAcrossDisplays,
      },
    },
    device: {
      layoutVersion: settings.layoutVersion,
      petPosition: settings.petPosition ? { ...settings.petPosition } : undefined,
      hudVisible: settings.hudVisible,
      debugVisible: settings.debugVisible,
      useMockData: settings.useMockData,
      autoStartAppServer: settings.autoStartAppServer,
    },
  };
}
