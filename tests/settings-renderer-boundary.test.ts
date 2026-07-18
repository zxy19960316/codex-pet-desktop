import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)],
    ),
  );
  return files.flat();
}

describe("settings renderer security boundary", () => {
  it("uses only the dedicated Settings API and no Electron or Node.js surface", async () => {
    const directory = join(process.cwd(), "src", "renderer", "settings");
    const files = (await filesUnder(directory)).filter((file) => /\.[cm]?[jt]sx?$/.test(file));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source).not.toMatch(
        /from\s+["'](?:electron|node:|fs["']|path["'])|\brequire\s*\(|\bprocess\./,
      );
      expect(source).not.toContain("DesktopApi");
      expect(source).not.toContain("window.codexPet.");
      expect(source).not.toMatch(/[A-Za-z]:[\\/](?:Users|Windows)[\\/]/);
    }
  });

  it("keeps the settings preload narrower than the pet DesktopApi", async () => {
    const source = await readFile(join(process.cwd(), "src", "preload", "settings.ts"), "utf8");
    expect(source).toContain('exposeInMainWorld("codexPetSettings"');
    expect(source).not.toContain("DesktopApi");
    expect(source).not.toContain("setPetState");
    expect(source).not.toContain("runVerification");
    expect(source).not.toContain("respondApproval");
  });
});
