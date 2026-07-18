import {
  clampPetScale,
  cloneSettingsDocument,
  DEFAULT_SETTINGS,
  DEFAULT_SETTINGS_DOCUMENT,
  settingsDocumentFromLocalSettings,
  type DeviceSettings,
  type LocalSettings,
  type SettingsDocumentV2,
  type SettingsDocumentV3,
  type SettingsPreferencesV2,
  type WindowPosition,
} from "../../shared/settings";

export class UnsupportedSettingsVersionError extends Error {
  readonly schemaVersion: unknown;

  constructor(schemaVersion: unknown) {
    super(`Unsupported settings schema version: ${String(schemaVersion)}`);
    this.name = "UnsupportedSettingsVersionError";
    this.schemaVersion = schemaVersion;
  }
}

export class InvalidSettingsDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSettingsDocumentError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validPosition(value: unknown): value is WindowPosition {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["x", "y"]) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y)
  );
}

function validQuota(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

function parsePreferencesV2(value: unknown): SettingsPreferencesV2 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["alwaysOnTop", "clickThrough", "soundEnabled", "quotaWarningPercent"]) ||
    typeof value.alwaysOnTop !== "boolean" ||
    typeof value.clickThrough !== "boolean" ||
    typeof value.soundEnabled !== "boolean" ||
    !validQuota(value.quotaWarningPercent)
  )
    throw new InvalidSettingsDocumentError("Invalid settings preferences");
  return {
    alwaysOnTop: value.alwaysOnTop,
    clickThrough: value.clickThrough,
    soundEnabled: value.soundEnabled,
    quotaWarningPercent: value.quotaWarningPercent,
  };
}

function parseDevice(value: unknown): DeviceSettings {
  if (!isRecord(value)) throw new InvalidSettingsDocumentError("Invalid device settings");
  if (
    !hasExactKeys(value, [
      "layoutVersion",
      ...(Object.hasOwn(value, "petPosition") ? ["petPosition"] : []),
      "hudVisible",
      "debugVisible",
      "useMockData",
      "autoStartAppServer",
    ]) ||
    !Number.isInteger(value.layoutVersion) ||
    (Object.hasOwn(value, "petPosition") && !validPosition(value.petPosition)) ||
    typeof value.hudVisible !== "boolean" ||
    typeof value.debugVisible !== "boolean" ||
    typeof value.useMockData !== "boolean" ||
    typeof value.autoStartAppServer !== "boolean"
  )
    throw new InvalidSettingsDocumentError("Invalid device settings");
  return {
    layoutVersion: value.layoutVersion as number,
    petPosition: validPosition(value.petPosition) ? { ...value.petPosition } : undefined,
    hudVisible: value.hudVisible,
    debugVisible: value.debugVisible,
    useMockData: value.useMockData,
    autoStartAppServer: value.autoStartAppServer,
  };
}

function parseV2(input: Record<string, unknown>): SettingsDocumentV3 {
  if (!hasExactKeys(input, ["schemaVersion", "preferences", "device"]))
    throw new InvalidSettingsDocumentError("Invalid v2 settings keys");
  const source: SettingsDocumentV2 = {
    schemaVersion: 2,
    preferences: parsePreferencesV2(input.preferences),
    device: parseDevice(input.device),
  };
  return {
    schemaVersion: 3,
    preferences: {
      ...source.preferences,
      petDisplay: {
        scalePercent: DEFAULT_SETTINGS.scalePercent,
        lockPhysicalSizeAcrossDisplays: DEFAULT_SETTINGS.lockPhysicalSizeAcrossDisplays,
      },
    },
    device: source.device,
  };
}

function parseV3(input: Record<string, unknown>): SettingsDocumentV3 {
  if (!hasExactKeys(input, ["schemaVersion", "preferences", "device"]))
    throw new InvalidSettingsDocumentError("Invalid v3 settings keys");
  if (!isRecord(input.preferences) || !Object.hasOwn(input.preferences, "petDisplay"))
    throw new InvalidSettingsDocumentError("Invalid v3 settings preferences");
  const preferences = input.preferences;
  if (
    !hasExactKeys(preferences, [
      "alwaysOnTop",
      "clickThrough",
      "soundEnabled",
      "quotaWarningPercent",
      "petDisplay",
    ]) ||
    !isRecord(preferences.petDisplay) ||
    !hasExactKeys(preferences.petDisplay, ["scalePercent", "lockPhysicalSizeAcrossDisplays"]) ||
    !isFiniteNumber(preferences.petDisplay.scalePercent) ||
    typeof preferences.petDisplay.lockPhysicalSizeAcrossDisplays !== "boolean"
  )
    throw new InvalidSettingsDocumentError("Invalid v3 pet display settings");
  const base = parsePreferencesV2({
    alwaysOnTop: preferences.alwaysOnTop,
    clickThrough: preferences.clickThrough,
    soundEnabled: preferences.soundEnabled,
    quotaWarningPercent: preferences.quotaWarningPercent,
  });
  return {
    schemaVersion: 3,
    preferences: {
      ...base,
      petDisplay: {
        scalePercent: clampPetScale(preferences.petDisplay.scalePercent),
        lockPhysicalSizeAcrossDisplays: preferences.petDisplay.lockPhysicalSizeAcrossDisplays,
      },
    },
    device: parseDevice(input.device),
  };
}

function legacyBoolean(input: Record<string, unknown>, key: keyof LocalSettings): boolean {
  const value = input[key];
  return typeof value === "boolean" ? value : (DEFAULT_SETTINGS[key] as boolean);
}

function migrateLegacy(input: Record<string, unknown>): SettingsDocumentV3 {
  const currentLayout = input.layoutVersion === DEFAULT_SETTINGS.layoutVersion;
  const legacy: LocalSettings = {
    layoutVersion: DEFAULT_SETTINGS.layoutVersion,
    petPosition: validPosition(input.petPosition) ? { ...input.petPosition } : undefined,
    alwaysOnTop: legacyBoolean(input, "alwaysOnTop"),
    clickThrough: legacyBoolean(input, "clickThrough"),
    hudVisible: currentLayout ? legacyBoolean(input, "hudVisible") : DEFAULT_SETTINGS.hudVisible,
    debugVisible: currentLayout
      ? legacyBoolean(input, "debugVisible")
      : DEFAULT_SETTINGS.debugVisible,
    useMockData: legacyBoolean(input, "useMockData"),
    autoStartAppServer: legacyBoolean(input, "autoStartAppServer"),
    soundEnabled: legacyBoolean(input, "soundEnabled"),
    quotaWarningPercent: validQuota(input.quotaWarningPercent)
      ? input.quotaWarningPercent
      : DEFAULT_SETTINGS.quotaWarningPercent,
    scalePercent: isFiniteNumber(input.scalePercent)
      ? clampPetScale(input.scalePercent)
      : DEFAULT_SETTINGS.scalePercent,
    lockPhysicalSizeAcrossDisplays: legacyBoolean(input, "lockPhysicalSizeAcrossDisplays"),
  };
  return settingsDocumentFromLocalSettings(legacy);
}

export class MigrationRegistry {
  migrate(input: unknown): SettingsDocumentV3 {
    if (!isRecord(input)) throw new InvalidSettingsDocumentError("Settings must be an object");
    if (!Object.hasOwn(input, "schemaVersion")) return migrateLegacy(input);
    if (input.schemaVersion === 2) return parseV2(input);
    if (input.schemaVersion === 3) return parseV3(input);
    throw new UnsupportedSettingsVersionError(input.schemaVersion);
  }

  defaults(): SettingsDocumentV3 {
    return cloneSettingsDocument(DEFAULT_SETTINGS_DOCUMENT);
  }
}
