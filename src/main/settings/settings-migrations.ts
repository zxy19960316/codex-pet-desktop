import {
  cloneSettingsDocument,
  DEFAULT_SETTINGS,
  DEFAULT_SETTINGS_DOCUMENT,
  type LocalSettings,
  type SettingsDocumentV2,
  settingsDocumentFromLocalSettings,
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

function parseV2(input: Record<string, unknown>): SettingsDocumentV2 {
  if (!hasExactKeys(input, ["schemaVersion", "preferences", "device"]))
    throw new InvalidSettingsDocumentError("Invalid v2 settings keys");
  if (!isRecord(input.preferences) || !isRecord(input.device))
    throw new InvalidSettingsDocumentError("Invalid v2 settings partitions");
  const preferences = input.preferences;
  const device = input.device;
  if (
    !hasExactKeys(preferences, [
      "alwaysOnTop",
      "clickThrough",
      "soundEnabled",
      "quotaWarningPercent",
    ]) ||
    !hasExactKeys(device, [
      "layoutVersion",
      ...(Object.hasOwn(device, "petPosition") ? ["petPosition"] : []),
      "hudVisible",
      "debugVisible",
      "useMockData",
      "autoStartAppServer",
    ])
  )
    throw new InvalidSettingsDocumentError("Invalid v2 settings fields");
  if (
    typeof preferences.alwaysOnTop !== "boolean" ||
    typeof preferences.clickThrough !== "boolean" ||
    typeof preferences.soundEnabled !== "boolean" ||
    !validQuota(preferences.quotaWarningPercent) ||
    !Number.isInteger(device.layoutVersion) ||
    (Object.hasOwn(device, "petPosition") && !validPosition(device.petPosition)) ||
    typeof device.hudVisible !== "boolean" ||
    typeof device.debugVisible !== "boolean" ||
    typeof device.useMockData !== "boolean" ||
    typeof device.autoStartAppServer !== "boolean"
  )
    throw new InvalidSettingsDocumentError("Invalid v2 settings values");
  return {
    schemaVersion: 2,
    preferences: {
      alwaysOnTop: preferences.alwaysOnTop,
      clickThrough: preferences.clickThrough,
      soundEnabled: preferences.soundEnabled,
      quotaWarningPercent: preferences.quotaWarningPercent,
    },
    device: {
      layoutVersion: device.layoutVersion as number,
      petPosition: validPosition(device.petPosition) ? { ...device.petPosition } : undefined,
      hudVisible: device.hudVisible,
      debugVisible: device.debugVisible,
      useMockData: device.useMockData,
      autoStartAppServer: device.autoStartAppServer,
    },
  };
}

function legacyBoolean(input: Record<string, unknown>, key: keyof LocalSettings): boolean {
  const value = input[key];
  return typeof value === "boolean" ? value : (DEFAULT_SETTINGS[key] as boolean);
}

function migrateLegacy(input: Record<string, unknown>): SettingsDocumentV2 {
  const legacy: LocalSettings = {
    layoutVersion: Number.isInteger(input.layoutVersion)
      ? (input.layoutVersion as number)
      : DEFAULT_SETTINGS.layoutVersion,
    petPosition: validPosition(input.petPosition) ? { ...input.petPosition } : undefined,
    alwaysOnTop: legacyBoolean(input, "alwaysOnTop"),
    clickThrough: legacyBoolean(input, "clickThrough"),
    hudVisible: legacyBoolean(input, "hudVisible"),
    debugVisible: legacyBoolean(input, "debugVisible"),
    useMockData: legacyBoolean(input, "useMockData"),
    autoStartAppServer: legacyBoolean(input, "autoStartAppServer"),
    soundEnabled: legacyBoolean(input, "soundEnabled"),
    quotaWarningPercent: validQuota(input.quotaWarningPercent)
      ? input.quotaWarningPercent
      : DEFAULT_SETTINGS.quotaWarningPercent,
  };
  return settingsDocumentFromLocalSettings(legacy);
}

export class MigrationRegistry {
  migrate(input: unknown): SettingsDocumentV2 {
    if (!isRecord(input)) throw new InvalidSettingsDocumentError("Settings must be an object");
    if (!Object.hasOwn(input, "schemaVersion")) return migrateLegacy(input);
    if (input.schemaVersion !== 2) throw new UnsupportedSettingsVersionError(input.schemaVersion);
    return parseV2(input);
  }

  defaults(): SettingsDocumentV2 {
    return cloneSettingsDocument(DEFAULT_SETTINGS_DOCUMENT);
  }
}
