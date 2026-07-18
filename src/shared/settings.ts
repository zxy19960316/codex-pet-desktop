export interface WindowPosition {
  x: number;
  y: number;
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
}

export interface SettingsPreferences {
  alwaysOnTop: boolean;
  clickThrough: boolean;
  soundEnabled: boolean;
  quotaWarningPercent: number;
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
  preferences: SettingsPreferences;
  device: DeviceSettings;
}

export type SettingsLoadState =
  | { kind: "missing" }
  | { kind: "loaded"; schemaVersion: 2 }
  | { kind: "migrated"; sourceVersion: 1 }
  | { kind: "corrupt" }
  | { kind: "future-version"; schemaVersion: number };

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
};

export const DEFAULT_SETTINGS_DOCUMENT: Readonly<SettingsDocumentV2> = {
  schemaVersion: 2,
  preferences: {
    alwaysOnTop: DEFAULT_SETTINGS.alwaysOnTop,
    clickThrough: DEFAULT_SETTINGS.clickThrough,
    soundEnabled: DEFAULT_SETTINGS.soundEnabled,
    quotaWarningPercent: DEFAULT_SETTINGS.quotaWarningPercent,
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
  document: Readonly<SettingsDocumentV2> = DEFAULT_SETTINGS_DOCUMENT,
): SettingsDocumentV2 {
  return {
    schemaVersion: 2,
    preferences: { ...document.preferences },
    device: {
      ...document.device,
      petPosition: document.device.petPosition ? { ...document.device.petPosition } : undefined,
    },
  };
}

export function localSettingsFromDocument(document: SettingsDocumentV2): LocalSettings {
  return {
    ...document.preferences,
    ...document.device,
    petPosition: document.device.petPosition ? { ...document.device.petPosition } : undefined,
  };
}

export function settingsDocumentFromLocalSettings(settings: LocalSettings): SettingsDocumentV2 {
  return {
    schemaVersion: 2,
    preferences: {
      alwaysOnTop: settings.alwaysOnTop,
      clickThrough: settings.clickThrough,
      soundEnabled: settings.soundEnabled,
      quotaWarningPercent: settings.quotaWarningPercent,
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
