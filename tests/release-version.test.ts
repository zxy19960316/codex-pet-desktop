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

  it("uses Electron package metadata for the Windows About panel", async () => {
    const source = await readFile("src/main/index.ts", "utf8");

    expect(source).toContain("applicationVersion: app.getVersion()");
    expect(source).not.toMatch(/applicationVersion:\s*["']\d+\.\d+\.\d+["']/);
  });
});
