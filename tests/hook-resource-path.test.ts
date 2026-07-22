import { describe, expect, it } from "vitest";
import { resolveHookReceiverPath } from "../src/main/hook-resource-path";

describe("hook receiver resource path", () => {
  it("uses an unpacked executable resource in packaged apps", () => {
    expect(
      resolveHookReceiverPath({
        isPackaged: true,
        resourcesPath: "C:\\App\\resources",
        mainDirectory: "C:\\App\\resources\\app.asar\\dist\\main",
      }),
    ).toBe("C:\\App\\resources\\codex-pet-hook.cjs");
  });

  it("uses the adjacent build output in development", () => {
    expect(
      resolveHookReceiverPath({
        isPackaged: false,
        resourcesPath: "C:\\repo",
        mainDirectory: "C:\\repo\\dist\\main",
      }),
    ).toBe("C:\\repo\\dist\\hook\\codex-pet-hook.cjs");
  });
});
