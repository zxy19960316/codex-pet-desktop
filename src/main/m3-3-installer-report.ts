import { isAbsolute } from "node:path";

export interface M33InstalledSettingsEvidence {
  passed: true;
  packaged: true;
  currentPetId: "e2e-sprout";
  availablePetIds: string[];
  previewsLoaded: true;
}

export interface M33InstallerReport {
  passed: true;
  platform: "win32";
  installer: string;
  installerSha256: string;
  signatureStatus: "NotSigned" | "Valid";
  installExitCode: 0;
  installedExecutable: string;
  settingsReport: M33InstalledSettingsEvidence;
  screenshot: string;
  uninstallExitCode: 0;
  installDirectoryRemoved: true;
  temporaryDataRemoved: true;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function requireTrue(value: Record<string, unknown>, key: string): void {
  if (value[key] !== true) throw new Error(`M3.3 installer evidence failed: ${key}`);
}

function requireAbsolutePath(value: Record<string, unknown>, key: string): void {
  if (typeof value[key] !== "string" || !isAbsolute(value[key]))
    throw new Error(`M3.3 installer ${key} must be an absolute path`);
}

export function validateM33InstallerReport(value: unknown): M33InstallerReport {
  const report = record(value, "M3.3 installer report");
  for (const key of ["passed", "installDirectoryRemoved", "temporaryDataRemoved"])
    requireTrue(report, key);
  if (report.platform !== "win32") throw new Error("M3.3 installer platform must be win32");
  for (const key of ["installer", "installedExecutable", "screenshot"])
    requireAbsolutePath(report, key);
  if (typeof report.installerSha256 !== "string" || !/^[a-f0-9]{64}$/.test(report.installerSha256))
    throw new Error("M3.3 installerSha256 must be a lowercase SHA-256 digest");
  if (report.signatureStatus !== "NotSigned" && report.signatureStatus !== "Valid")
    throw new Error("M3.3 installer signatureStatus must be NotSigned or Valid");
  if (report.installExitCode !== 0) throw new Error("M3.3 installer installExitCode must be zero");
  if (report.uninstallExitCode !== 0)
    throw new Error("M3.3 installer uninstallExitCode must be zero");

  const settings = record(report.settingsReport, "M3.3 installed Settings report");
  for (const key of ["passed", "packaged", "previewsLoaded"]) requireTrue(settings, key);
  if (settings.currentPetId !== "e2e-sprout")
    throw new Error("M3.3 installed Settings currentPetId must be e2e-sprout");
  if (
    !Array.isArray(settings.availablePetIds) ||
    !settings.availablePetIds.includes("pixel-sprout") ||
    !settings.availablePetIds.includes("e2e-sprout")
  )
    throw new Error("M3.3 installed Settings report is missing expected pets");
  return report as unknown as M33InstallerReport;
}
