import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "../src/main/settings/settings-service";
import { SettingsStore, type SettingsFileOperations } from "../src/main/settings/settings-store";
import { DEFAULT_SETTINGS, DEFAULT_SETTINGS_DOCUMENT } from "../src/shared/settings";

const temporaryDirectories: string[] = [];

async function temporarySettings() {
  const directory = await mkdtemp(join(tmpdir(), "codex-pet-settings-"));
  temporaryDirectories.push(directory);
  return {
    directory,
    legacyPath: join(directory, "settings.json"),
    v2Path: join(directory, "settings.v2.json"),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("settings service", () => {
  it("starts from defaults when files are missing and persists the first patch", async () => {
    const paths = await temporarySettings();
    const service = new SettingsService(new SettingsStore(paths));

    expect(await service.initialize()).toEqual(DEFAULT_SETTINGS);
    expect(service.getLoadState()).toEqual({ kind: "missing" });

    await service.patch({ soundEnabled: true });
    expect(JSON.parse(await readFile(paths.v2Path, "utf8"))).toEqual({
      ...DEFAULT_SETTINGS_DOCUMENT,
      preferences: { ...DEFAULT_SETTINGS_DOCUMENT.preferences, soundEnabled: true },
    });
  });

  it("migrates a valid legacy file once while preserving the legacy source", async () => {
    const paths = await temporarySettings();
    const legacy = { alwaysOnTop: false, clickThrough: true, quotaWarningPercent: 45 };
    await writeFile(paths.legacyPath, JSON.stringify(legacy), "utf8");

    const service = new SettingsService(new SettingsStore(paths));
    expect(await service.initialize()).toMatchObject(legacy);
    expect(service.getLoadState()).toEqual({ kind: "migrated", sourceVersion: 1 });
    expect(await readFile(paths.legacyPath, "utf8")).toBe(JSON.stringify(legacy));
    expect(JSON.parse(await readFile(paths.v2Path, "utf8"))).toMatchObject({
      schemaVersion: 2,
      preferences: legacy,
    });
  });

  it("uses defaults for corrupt JSON and never overwrites the damaged file", async () => {
    const paths = await temporarySettings();
    await writeFile(paths.v2Path, "{broken-json", "utf8");
    const service = new SettingsService(new SettingsStore(paths));

    expect(await service.initialize()).toEqual(DEFAULT_SETTINGS);
    expect(service.getLoadState()).toEqual({ kind: "corrupt" });
    await service.patch({ alwaysOnTop: false });

    expect(service.getSettings().alwaysOnTop).toBe(false);
    expect(await readFile(paths.v2Path, "utf8")).toBe("{broken-json");
  });

  it("protects an unknown future schema from every automatic write", async () => {
    const paths = await temporarySettings();
    const future = JSON.stringify({ ...DEFAULT_SETTINGS_DOCUMENT, schemaVersion: 9 });
    await writeFile(paths.v2Path, future, "utf8");
    const service = new SettingsService(new SettingsStore(paths));

    expect(await service.initialize()).toEqual(DEFAULT_SETTINGS);
    expect(service.getLoadState()).toEqual({ kind: "future-version", schemaVersion: 9 });
    await service.patch({ clickThrough: true });

    expect(service.getSettings().clickThrough).toBe(true);
    expect(await readFile(paths.v2Path, "utf8")).toBe(future);
  });

  it("treats a non-numeric schema version as a corrupt protected document", async () => {
    const paths = await temporarySettings();
    const invalid = JSON.stringify({ ...DEFAULT_SETTINGS_DOCUMENT, schemaVersion: "next" });
    await writeFile(paths.v2Path, invalid, "utf8");
    const service = new SettingsService(new SettingsStore(paths));

    expect(await service.initialize()).toEqual(DEFAULT_SETTINGS);
    expect(service.getLoadState()).toEqual({ kind: "corrupt" });
    expect(await readFile(paths.v2Path, "utf8")).toBe(invalid);
  });

  it("writes a complete temporary file before atomically renaming it", async () => {
    const paths = await temporarySettings();
    const calls: string[] = [];
    let serialized = "";
    const operations: SettingsFileOperations = {
      mkdir: async () => undefined,
      readFile: async () => {
        const error = Object.assign(new Error("missing"), { code: "ENOENT" });
        throw error;
      },
      writeFile: async (path, value) => {
        calls.push(`write:${path}`);
        serialized = value;
      },
      rename: async (from, to) => {
        calls.push(`rename:${from}->${to}`);
      },
      rm: async () => undefined,
    };
    const store = new SettingsStore({ ...paths, operations });

    await store.write(DEFAULT_SETTINGS_DOCUMENT);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/write:.*settings\.v2\.json\..*\.tmp$/);
    expect(calls[1]).toMatch(/rename:.*\.tmp->.*settings\.v2\.json$/);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(JSON.parse(serialized)).toEqual(DEFAULT_SETTINGS_DOCUMENT);
  });

  it("keeps the previous file when atomic rename fails", async () => {
    const paths = await temporarySettings();
    await writeFile(paths.v2Path, JSON.stringify(DEFAULT_SETTINGS_DOCUMENT), "utf8");
    const operations: Partial<SettingsFileOperations> = {
      rename: async () => {
        throw new Error("rename denied");
      },
    };
    const store = new SettingsStore({ ...paths, operations });

    await expect(
      store.write({
        ...DEFAULT_SETTINGS_DOCUMENT,
        preferences: { ...DEFAULT_SETTINGS_DOCUMENT.preferences, alwaysOnTop: false },
      }),
    ).rejects.toThrow("rename denied");
    expect(JSON.parse(await readFile(paths.v2Path, "utf8"))).toEqual(DEFAULT_SETTINGS_DOCUMENT);
  });

  it("serializes concurrent patches and immediately notifies supported live fields", async () => {
    const paths = await temporarySettings();
    const service = new SettingsService(new SettingsStore(paths));
    await service.initialize();
    const listener = vi.fn();
    service.subscribe(listener);

    await Promise.all([
      service.patch({ alwaysOnTop: false }),
      service.patch({ clickThrough: true }),
      service.patch({ quotaWarningPercent: 30 }),
    ]);

    expect(service.getSettings()).toMatchObject({
      alwaysOnTop: false,
      clickThrough: true,
      quotaWarningPercent: 30,
    });
    expect(listener).toHaveBeenCalledTimes(3);
    expect(JSON.parse(await readFile(paths.v2Path, "utf8"))).toMatchObject({
      preferences: { alwaysOnTop: false, clickThrough: true, quotaWarningPercent: 30 },
    });
  });
});
