import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBuiltinPetsDirectory } from "../src/main/pet-resource-path";

describe("packaged pet resource path", () => {
  it("uses appPath pets in development", () => {
    expect(
      resolveBuiltinPetsDirectory({
        appPath: "C:/repo/codex-pet-desktop",
        resourcesPath: "C:/bundle/resources",
        isPackaged: false,
      }),
    ).toBe(resolve("C:/repo/codex-pet-desktop", "pets"));
  });

  it("uses external resources pets in a packaged application", () => {
    expect(
      resolveBuiltinPetsDirectory({
        appPath: "C:/bundle/resources/app.asar",
        resourcesPath: "C:/bundle/resources",
        isPackaged: true,
      }),
    ).toBe(resolve("C:/bundle/resources", "pets"));
  });
});
