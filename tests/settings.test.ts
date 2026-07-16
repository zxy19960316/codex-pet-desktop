import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clampWindowPosition, LocalSettingsStore } from "../src/main/position-store";

const temporaryDirectories: string[] = [];
afterEach(async () =>
  Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  ),
);

describe("local settings", () => {
  it("uses safe defaults and persists supported settings", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-pet-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "settings.json");
    const store = new LocalSettingsStore(path);
    expect((await store.read()).alwaysOnTop).toBe(true);
    expect((await store.read()).hudVisible).toBe(false);
    await store.patch({ clickThrough: true, quotaWarningPercent: 15 });
    expect(await store.read()).toMatchObject({ clickThrough: true, quotaWarningPercent: 15 });
    expect(await readFile(path, "utf8")).not.toContain("token");
  });

  it("migrates the old developer-panel layout to the compact pet", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-pet-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "settings.json");
    await writeFile(path, JSON.stringify({ hudVisible: true, debugVisible: true }), "utf8");
    const settings = await new LocalSettingsStore(path).read();
    expect(settings).toMatchObject({ layoutVersion: 1, hudVisible: false, debugVisible: false });
  });

  it("clamps a saved position into the nearest display work area", () => {
    expect(
      clampWindowPosition(
        { x: 9999, y: -50 },
        { x: 1920, y: 0, width: 1920, height: 1080 },
        { width: 260, height: 300 },
      ),
    ).toEqual({ x: 3580, y: 0 });
  });
});
