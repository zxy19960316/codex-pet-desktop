import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { arch, platform, tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";

const root = process.cwd();
const applicationName = "Codex Pet Desktop";
const verificationRoot = join(root, "tmp", "m3-2-e2e");
const userDataDirectory = join(tmpdir(), `codex-pet-m3-2-e2e-${process.pid}`);
const importSource = join(verificationRoot, "import-source", "e2e-sprout");
const resultsDirectory = join(verificationRoot, "results");
const packagedDirectory = join(root, "release", `${applicationName}-${platform()}-${arch()}`);
const executable =
  platform() === "win32"
    ? join(packagedDirectory, `${applicationName}.exe`)
    : platform() === "darwin"
      ? join(packagedDirectory, `${applicationName}.app`, "Contents", "MacOS", applicationName)
      : join(packagedDirectory, applicationName);
const packagedManifest =
  platform() === "darwin"
    ? join(
        packagedDirectory,
        `${applicationName}.app`,
        "Contents",
        "Resources",
        "pets",
        "example-original-pet",
        "manifest.json",
      )
    : join(packagedDirectory, "resources", "pets", "example-original-pet", "manifest.json");

async function requireFile(path, label) {
  try {
    const value = await stat(path);
    if (!value.isFile()) throw new Error(`${label} is not a file: ${path}`);
  } catch (error) {
    throw new Error(`${label} is unavailable: ${path}`, { cause: error });
  }
}

function appendBounded(current, chunk) {
  const combined = current + chunk.toString("utf8");
  return combined.slice(-32_768);
}

async function launchPhase(phase) {
  const outputDirectory = join(resultsDirectory, phase);
  await mkdir(outputDirectory, { recursive: true });
  const startedAt = Date.now();
  const result = await new Promise((resolveLaunch, rejectLaunch) => {
    const child = spawn(executable, ["--m3-2-e2e"], {
      cwd: root,
      windowsHide: true,
      env: {
        ...process.env,
        CODEX_PET_M3_2_PHASE: phase,
        CODEX_PET_M3_2_USER_DATA: userDataDirectory,
        CODEX_PET_M3_2_OUTPUT: outputDirectory,
        CODEX_PET_M3_2_IMPORT_SOURCE: phase === "import" ? importSource : undefined,
      },
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
      rejectLaunch(new Error(`M3.2 ${phase} phase timed out`));
    }, 60_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectLaunch(new Error(`M3.2 ${phase} phase could not start`, { cause: error }));
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0)
        rejectLaunch(
          new Error(
            `M3.2 ${phase} phase exited with ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        );
      else resolveLaunch({ stdout, stderr });
    });
  });
  const reportPath = join(outputDirectory, "report.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  return { report, durationMs: Date.now() - startedAt, process: result };
}

function requireEvidence(report, phase) {
  if (report.phase !== phase || report.passed !== true || report.packaged !== true)
    throw new Error(`M3.2 ${phase} report did not pass packaged verification`);
  if (report.currentPetId !== "e2e-sprout" || report.previewsLoaded !== true)
    throw new Error(`M3.2 ${phase} report did not retain the imported pet and previews`);
  for (const id of ["pixel-sprout", "e2e-sprout"])
    if (!report.availablePetIds?.includes(id))
      throw new Error(`M3.2 ${phase} report is missing ${id}`);
  if (phase === "import") {
    for (const field of ["imported", "switchedToBuiltin", "switchedBack"])
      if (report[field] !== true) throw new Error(`M3.2 import report failed ${field}`);
  } else if (report.rescanned !== true) throw new Error("M3.2 restart report failed rescan");
}

await Promise.all([
  requireFile(executable, "Packaged executable"),
  requireFile(packagedManifest, "Packaged pet manifest"),
]);
await Promise.all([
  rm(verificationRoot, { recursive: true, force: true }),
  rm(userDataDirectory, { recursive: true, force: true }),
]);
await mkdir(join(verificationRoot, "import-source"), { recursive: true });
await cp(join(root, "pets", "example-original-pet"), importSource, { recursive: true });
const fixtureManifestPath = join(importSource, "manifest.json");
const fixtureManifest = JSON.parse(await readFile(fixtureManifestPath, "utf8"));
fixtureManifest.id = "e2e-sprout";
fixtureManifest.name = "E2E Sprout";
fixtureManifest.version = "1.0.0-e2e";
await writeFile(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`, "utf8");

const importPhase = await launchPhase("import");
requireEvidence(importPhase.report, "import");
await Promise.all([
  requireFile(join(userDataDirectory, "pets", "e2e-sprout", "manifest.json"), "Imported pet"),
  requireFile(join(userDataDirectory, "pets", ".active-pet.json"), "Active pet state"),
  requireFile(importPhase.report.screenshot, "Import Settings screenshot"),
]);

const restartPhase = await launchPhase("restart");
requireEvidence(restartPhase.report, "restart");
await requireFile(restartPhase.report.screenshot, "Restart Settings screenshot");

const combined = {
  passed: true,
  packagedExecutable: executable,
  packagedPetManifest: packagedManifest,
  userDataDirectory,
  import: { report: importPhase.report, durationMs: importPhase.durationMs },
  restart: { report: restartPhase.report, durationMs: restartPhase.durationMs },
};
const combinedPath = join(resultsDirectory, "combined.json");
await writeFile(combinedPath, `${JSON.stringify(combined, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ passed: true, combinedPath, executable })}\n`);
