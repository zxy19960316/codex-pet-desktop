import { describe, expect, it } from "vitest";
import {
  MigrationRegistry,
  UnsupportedSettingsVersionError,
} from "../src/main/settings/settings-migrations";
import { DEFAULT_SETTINGS_DOCUMENT } from "../src/shared/settings";

describe("settings migrations", () => {
  it("maps every supported legacy flat field into the v3 partitions", () => {
    const migrated = new MigrationRegistry().migrate({
      layoutVersion: 1,
      petPosition: { x: 120, y: 240 },
      alwaysOnTop: false,
      clickThrough: true,
      hudVisible: true,
      debugVisible: true,
      useMockData: true,
      autoStartAppServer: true,
      soundEnabled: true,
      quotaWarningPercent: 35,
      ignoredLegacyField: "not-copied",
    });

    expect(migrated).toEqual({
      schemaVersion: 3,
      preferences: {
        alwaysOnTop: false,
        clickThrough: true,
        soundEnabled: true,
        quotaWarningPercent: 35,
        petDisplay: {
          scalePercent: 100,
          lockPhysicalSizeAcrossDisplays: false,
        },
      },
      device: {
        layoutVersion: 1,
        petPosition: { x: 120, y: 240 },
        hudVisible: true,
        debugVisible: true,
        useMockData: true,
        autoStartAppServer: true,
        launchAtLogin: false,
      },
    });
    expect(JSON.stringify(migrated)).not.toContain("ignoredLegacyField");
  });

  it("fills missing and invalid legacy fields from safe defaults", () => {
    const migrated = new MigrationRegistry().migrate({
      alwaysOnTop: "yes",
      clickThrough: 1,
      quotaWarningPercent: 101,
      petPosition: { x: "left", y: 4 },
    });

    expect(migrated).toEqual(DEFAULT_SETTINGS_DOCUMENT);
  });

  it("keeps the legacy compact-layout reset when layoutVersion is missing", () => {
    const migrated = new MigrationRegistry().migrate({
      hudVisible: true,
      debugVisible: true,
    });

    expect(migrated.device).toMatchObject({
      layoutVersion: 1,
      hudVisible: false,
      debugVisible: false,
    });
  });

  it("migrates a valid v2 document with safe display defaults", () => {
    const v2 = {
      schemaVersion: 2,
      preferences: {
        alwaysOnTop: false,
        clickThrough: true,
        soundEnabled: true,
        quotaWarningPercent: 42,
      },
      device: { ...DEFAULT_SETTINGS_DOCUMENT.device },
    };
    expect(new MigrationRegistry().migrate(v2)).toEqual({
      schemaVersion: 3,
      preferences: {
        ...v2.preferences,
        petDisplay: { scalePercent: 100, lockPhysicalSizeAcrossDisplays: false },
      },
      device: v2.device,
    });
  });

  it("upgrades an older v3 device document to automatic Codex detection", () => {
    const legacyV3 = {
      ...DEFAULT_SETTINGS_DOCUMENT,
      device: {
        layoutVersion: 1,
        hudVisible: false,
        debugVisible: false,
        useMockData: false,
        autoStartAppServer: false,
      },
    };

    expect(new MigrationRegistry().migrate(legacyV3).device).toEqual({
      ...legacyV3.device,
      autoStartAppServer: true,
      launchAtLogin: false,
    });
  });

  it("clamps invalid current scale ranges and clones nested defaults", () => {
    const registry = new MigrationRegistry();
    const first = registry.migrate({
      ...DEFAULT_SETTINGS_DOCUMENT,
      preferences: {
        ...DEFAULT_SETTINGS_DOCUMENT.preferences,
        petDisplay: { scalePercent: 500, lockPhysicalSizeAcrossDisplays: true },
      },
    });
    const second = registry.migrate(DEFAULT_SETTINGS_DOCUMENT);

    expect(first.preferences.petDisplay).toEqual({
      scalePercent: 200,
      lockPhysicalSizeAcrossDisplays: true,
    });
    expect(first).not.toBe(second);
    expect(first.preferences).not.toBe(second.preferences);
    expect(first.preferences.petDisplay).not.toBe(second.preferences.petDisplay);
    expect(first.device).not.toBe(second.device);
  });

  it("rejects unknown future schema versions", () => {
    expect(() =>
      new MigrationRegistry().migrate({
        ...DEFAULT_SETTINGS_DOCUMENT,
        schemaVersion: 99,
      }),
    ).toThrow(UnsupportedSettingsVersionError);
  });
});
