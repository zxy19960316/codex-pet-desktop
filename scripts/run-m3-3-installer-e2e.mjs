import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";

if (process.platform !== "win32") throw new Error("M3.3 installer E2E requires Windows");

const root = process.cwd();
const packageDocument = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const installerName = `codex-pet-desktop-${packageDocument.version}-setup-x64.exe`;
const installer = join(root, "release", "m3-3", installerName);
const checksumPath = `${installer}.sha256`;
const verificationRoot = join(root, "tmp", "m3-3-e2e");
const settingsOutput = join(verificationRoot, "installed-settings");
const importParent = join(verificationRoot, "import-source");
const importSource = join(importParent, "e2e-sprout");
const screenshot = join(verificationRoot, "settings-installed.png");
const reportPath = join(verificationRoot, "report.json");
const installDirectory = join(tmpdir(), `codex-pet-m3-3-install-${process.pid}`);
const userDataDirectory = join(tmpdir(), `codex-pet-m3-3-user-data-${process.pid}`);

function appendBounded(current, chunk) {
  return (current + chunk.toString("utf8")).slice(-32_768);
}

async function run(executable, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk);
    });
    const timeout = setTimeout(() => {
      child.kill();
      rejectRun(new Error(`${executable} timed out after ${options.timeoutMs ?? 90_000}ms`));
    }, options.timeoutMs ?? 90_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectRun(new Error(`Could not start ${executable}`, { cause: error }));
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0)
        rejectRun(
          new Error(`${executable} exited with ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`),
        );
      else resolveRun({ code, stdout, stderr });
    });
  });
}

async function requireFile(path, label) {
  const value = await stat(path);
  if (!value.isFile()) throw new Error(`${label} is not a file: ${path}`);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    throw error;
  }
}

async function waitForMissing(path, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await exists(path))) return true;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  return !(await exists(path));
}

async function authenticodeStatus(path) {
  const result = await run(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "(Get-AuthenticodeSignature -LiteralPath $env:CODEX_PET_SIGNATURE_TARGET).Status.ToString()",
    ],
    { env: { ...process.env, CODEX_PET_SIGNATURE_TARGET: path }, timeoutMs: 30_000 },
  );
  const status = result.stdout.trim();
  if (status !== "NotSigned" && status !== "Valid")
    throw new Error(`Unexpected Authenticode status: ${status || "empty"}`);
  return status;
}

function requireInstalledSettingsEvidence(report) {
  if (
    report?.passed !== true ||
    report.packaged !== true ||
    report.currentPetId !== "e2e-sprout" ||
    report.previewsLoaded !== true ||
    !report.availablePetIds?.includes("pixel-sprout") ||
    !report.availablePetIds?.includes("e2e-sprout")
  )
    throw new Error(`Installed Settings evidence is incomplete: ${JSON.stringify(report)}`);
}

await Promise.all([requireFile(installer, "Installer"), requireFile(checksumPath, "Checksum")]);
await Promise.all([
  rm(verificationRoot, { recursive: true, force: true }),
  rm(installDirectory, { recursive: true, force: true }),
  rm(userDataDirectory, { recursive: true, force: true }),
]);
await mkdir(importParent, { recursive: true });
await cp(join(root, "pets", "example-original-pet"), importSource, { recursive: true });
const fixtureManifestPath = join(importSource, "manifest.json");
const fixtureManifest = JSON.parse(await readFile(fixtureManifestPath, "utf8"));
fixtureManifest.id = "e2e-sprout";
fixtureManifest.name = "E2E Sprout";
fixtureManifest.version = "1.0.0-m3-3";
await writeFile(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`, "utf8");

try {
  const installerBytes = await readFile(installer);
  const installerSha256 = createHash("sha256").update(installerBytes).digest("hex");
  const checksum = await readFile(checksumPath, "utf8");
  if (!checksum.startsWith(`${installerSha256}  ${installerName}`))
    throw new Error("Installer checksum file does not match the installer");
  const signatureStatus = await authenticodeStatus(installer);

  const install = await run(installer, ["/currentuser", "/S", `/D=${installDirectory}`], {
    timeoutMs: 120_000,
  });
  const installedExecutable = join(installDirectory, "Codex Pet Desktop.exe");
  const installedManifest = join(
    installDirectory,
    "resources",
    "pets",
    "example-original-pet",
    "manifest.json",
  );
  await Promise.all([
    requireFile(installedExecutable, "Installed executable"),
    requireFile(installedManifest, "Installed built-in pet"),
  ]);

  await mkdir(settingsOutput, { recursive: true });
  await run(installedExecutable, ["--m3-2-e2e"], {
    env: {
      ...process.env,
      CODEX_PET_M3_2_PHASE: "import",
      CODEX_PET_M3_2_USER_DATA: userDataDirectory,
      CODEX_PET_M3_2_OUTPUT: settingsOutput,
      CODEX_PET_M3_2_IMPORT_SOURCE: importSource,
    },
    timeoutMs: 60_000,
  });
  const settingsReport = JSON.parse(await readFile(join(settingsOutput, "report.json"), "utf8"));
  requireInstalledSettingsEvidence(settingsReport);
  await cp(settingsReport.screenshot, screenshot);
  await requireFile(screenshot, "Installed Settings screenshot");
  settingsReport.screenshot = screenshot;

  const uninstaller = join(installDirectory, "Uninstall Codex Pet Desktop.exe");
  await requireFile(uninstaller, "Uninstaller");
  const uninstall = await run(uninstaller, ["/currentuser", "/S"], { timeoutMs: 120_000 });
  const installDirectoryRemoved = await waitForMissing(installDirectory);
  if (!installDirectoryRemoved)
    throw new Error(`Uninstaller did not remove the installation directory: ${installDirectory}`);

  await Promise.all([
    rm(userDataDirectory, { recursive: true, force: true }),
    rm(importParent, { recursive: true, force: true }),
    rm(settingsOutput, { recursive: true, force: true }),
  ]);
  const temporaryDataRemoved =
    !(await exists(userDataDirectory)) &&
    !(await exists(importParent)) &&
    !(await exists(settingsOutput));
  if (!temporaryDataRemoved) throw new Error("Verifier-owned temporary data was not removed");

  const report = {
    passed: true,
    platform: process.platform,
    installer,
    installerSha256,
    signatureStatus,
    installExitCode: install.code,
    installedExecutable,
    settingsReport,
    screenshot,
    uninstallExitCode: uninstall.code,
    installDirectoryRemoved,
    temporaryDataRemoved,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ passed: true, reportPath, screenshot })}\n`);
} catch (error) {
  await mkdir(verificationRoot, { recursive: true });
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        passed: false,
        error: error instanceof Error ? error.message : "Unknown installer E2E error",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  throw error;
}
