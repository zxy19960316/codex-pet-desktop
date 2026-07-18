import { describe, expect, it } from "vitest";
import {
  MigrationRegistry,
  UnsupportedSettingsVersionError,
} from "../src/main/settings/settings-migrations";
import { DEFAULT_SETTINGS_DOCUMENT } from "../src/shared/settings";

describe("settings migrations", () => {
  it("maps every supported legacy flat field into the v2 partitions", () => {
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
      schemaVersion: 2,
      preferences: {
        alwaysOnTop: false,
        clickThrough: true,
        soundEnabled: true,
        quotaWarningPercent: 35,
      },
      device: {
        layoutVersion: 1,
        petPosition: { x: 120, y: 240 },
        hudVisible: true,
        debugVisible: true,
        useMockData: true,
        autoStartAppServer: true,
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

  it("clones a valid v2 document instead of sharing mutable defaults", () => {
    const registry = new MigrationRegistry();
    const first = registry.migrate(DEFAULT_SETTINGS_DOCUMENT);
    const second = registry.migrate(DEFAULT_SETTINGS_DOCUMENT);

    expect(first).toEqual(DEFAULT_SETTINGS_DOCUMENT);
    expect(first).not.toBe(second);
    expect(first.preferences).not.toBe(second.preferences);
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
