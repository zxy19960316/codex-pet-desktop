import { describe, expect, it } from "vitest";
import { resolveTrayIconPath } from "../src/main/app-icon-path";

describe("tray icon resource path", () => {
  it("uses the external runtime resource in packaged apps", () => {
    expect(
      resolveTrayIconPath({
        isPackaged: true,
        resourcesPath: "C:\\App\\resources",
        projectDirectory: "C:\\repo",
      }),
    ).toBe("C:\\App\\resources\\tray-icon.png");
  });

  it("uses the generated branding derivative in development", () => {
    expect(
      resolveTrayIconPath({
        isPackaged: false,
        resourcesPath: "C:\\App\\resources",
        projectDirectory: "C:\\repo",
      }),
    ).toBe("C:\\repo\\build\\generated\\tray-icon.png");
  });
});
