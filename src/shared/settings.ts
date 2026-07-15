export interface WindowPosition {
  x: number;
  y: number;
}

export interface LocalSettings {
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
  alwaysOnTop: true,
  clickThrough: false,
  hudVisible: true,
  debugVisible: false,
  useMockData: false,
  autoStartAppServer: true,
  soundEnabled: false,
  quotaWarningPercent: 20,
};
