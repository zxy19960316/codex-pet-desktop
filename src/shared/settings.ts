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
