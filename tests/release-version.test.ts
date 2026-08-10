import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("release version metadata", () => {
  it("keeps package and lockfile SemVer versions aligned", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const packageLock = JSON.parse(await readFile("package-lock.json", "utf8"));

    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[""].version).toBe(packageJson.version);
  });

  it("keeps v1.1 release downloads, bundled assets, and noncommercial terms aligned", async () => {
    const [packageText, lockText, petText, license, readme, chineseReadme, changelog] =
      await Promise.all([
        readFile("package.json", "utf8"),
        readFile("package-lock.json", "utf8"),
        readFile("pets/example-original-pet/manifest.json", "utf8"),
        readFile("LICENSE", "utf8"),
        readFile("README.md", "utf8"),
        readFile("README.zh-CN.md", "utf8"),
        readFile("CHANGELOG.md", "utf8"),
      ]);
    const packageJson = JSON.parse(packageText);
    const packageLock = JSON.parse(lockText);
    const pet = JSON.parse(petText);
    const installer = `codex-pet-desktop-${packageJson.version}-setup-x64.exe`;

    expect(packageJson).toMatchObject({
      version: "1.1.0",
      license: "PolyForm-Noncommercial-1.0.0",
    });
    expect(packageLock.packages[""].license).toBe(packageJson.license);
    expect(pet).toMatchObject({ version: packageJson.version, license: packageJson.license });
    expect(license).toContain("# PolyForm Noncommercial License 1.0.0");
    expect(license).toContain("Required Notice: Copyright 2026 Codex Pet Desktop contributors.");
    expect(readme).toContain(installer);
    expect(chineseReadme).toContain(installer);
    expect(readme).toContain("General commercial use is not licensed");
    expect(chineseReadme).toContain("不得用于商业目的");
    expect(changelog).toContain(`## [${packageJson.version}] - 2026-08-10`);
  });

  it("uses Electron package metadata for the Windows About panel", async () => {
    const source = await readFile("src/main/index.ts", "utf8");

    expect(source).toContain("applicationVersion: app.getVersion()");
    expect(source).not.toMatch(/applicationVersion:\s*["']\d+\.\d+\.\d+["']/);
    expect(source).toContain("PolyForm Noncommercial licensed independent project");
    expect(source).not.toContain("MIT licensed independent project");
  });
});
