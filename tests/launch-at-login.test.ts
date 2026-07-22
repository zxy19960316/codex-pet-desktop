import { describe, expect, it, vi } from "vitest";
import { LaunchAtLoginController } from "../src/main/launch-at-login";

describe("launch at login", () => {
  it("registers only the packaged application executable", () => {
    const setLoginItemSettings = vi.fn();
    const packaged = new LaunchAtLoginController({
      isPackaged: true,
      executablePath: "C:\\Program Files\\Codex Pet Desktop\\Codex Pet Desktop.exe",
      setLoginItemSettings,
    });

    packaged.sync(true);
    expect(setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      path: "C:\\Program Files\\Codex Pet Desktop\\Codex Pet Desktop.exe",
    });
  });

  it("does not register Electron development mode", () => {
    const setLoginItemSettings = vi.fn();
    new LaunchAtLoginController({
      isPackaged: false,
      executablePath: "C:\\repo\\node_modules\\electron\\electron.exe",
      setLoginItemSettings,
    }).sync(true);

    expect(setLoginItemSettings).not.toHaveBeenCalled();
  });
});
