import { describe, expect, it } from "vitest";
import { validateM33InstallerReport } from "../src/main/m3-3-installer-report";

const passingReport = {
  passed: true,
  platform: "win32",
  installer: "C:/tmp/codex-pet-setup.exe",
  installerSha256: "a".repeat(64),
  signatureStatus: "NotSigned",
  installExitCode: 0,
  installedExecutable: "C:/tmp/install/Codex Pet Desktop.exe",
  settingsReport: {
    passed: true,
    packaged: true,
    currentPetId: "codex-pokepets-synthetic-geo",
    availablePetIds: ["e2e-sprout", "pixel-sprout", "codex-pokepets-synthetic-geo"],
    previewsLoaded: true,
    codexImported: true,
    scalePreviewVerified: true,
  },
  screenshot: "C:/tmp/settings-installed.png",
  uninstallExitCode: 0,
  installDirectoryRemoved: true,
  temporaryDataRemoved: true,
};

describe("M3.3 installer lifecycle report", () => {
  it("accepts complete unsigned or valid-signed installer evidence", () => {
    expect(validateM33InstallerReport(passingReport)).toEqual(passingReport);
    expect(
      validateM33InstallerReport({ ...passingReport, signatureStatus: "Valid" }),
    ).toMatchObject({
      signatureStatus: "Valid",
    });
  });

  it("rejects incomplete lifecycle and Settings evidence", () => {
    expect(() =>
      validateM33InstallerReport({ ...passingReport, installDirectoryRemoved: false }),
    ).toThrow("installDirectoryRemoved");
    expect(() =>
      validateM33InstallerReport({
        ...passingReport,
        settingsReport: { ...passingReport.settingsReport, previewsLoaded: false },
      }),
    ).toThrow("previewsLoaded");
    expect(() =>
      validateM33InstallerReport({ ...passingReport, signatureStatus: "UnknownError" }),
    ).toThrow("signatureStatus");
  });
});
