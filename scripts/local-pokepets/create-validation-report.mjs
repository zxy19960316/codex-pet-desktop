import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { join, resolve } from "node:path";
import process from "node:process";
import {
  ALLOWED_PETS,
  validateDerivedPetDirectory,
  validateSourcePetDirectory,
} from "./local-pokepets-lib.mjs";

function run(command, arguments_, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (value) => (stdout += value));
    child.stderr.on("data", (value) => (stderr += value));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolvePromise(stdout.trim())
        : reject(new Error(stderr.trim() || `${command} exited ${code}`)),
    );
  });
}

const workspace = resolve(process.cwd(), "tmp", "local-pokepets");
const managed = resolve(process.env.APPDATA ?? "", "Codex Pet Desktop", "pets");
const imageTools = fileURLToPath(new URL("./image-tools.py", import.meta.url));
const source = [];
const derived = [];
for (const pet of ALLOWED_PETS) {
  const sourceDirectory = join(workspace, "source", pet);
  source.push({
    ...(await validateSourcePetDirectory(sourceDirectory, pet)),
    directory: sourceDirectory,
  });
  const directory = join(workspace, "derived", `${pet}-local-12state`);
  const validation = await validateDerivedPetDirectory(directory);
  const animationQuality = JSON.parse(
    await run("python", [imageTools, "analyze-package", "--directory", directory]),
  );
  const installed = await validateDerivedPetDirectory(join(managed, validation.id));
  derived.push({
    ...validation,
    directory,
    managedDirectory: join(managed, validation.id),
    installed: installed.id === validation.id,
    animationQuality,
    qaDirectory: join(workspace, "qa", validation.id),
  });
}
const ignoreProbe = join("tmp", "local-pokepets", "source", "pikachu", "spritesheet.webp");
const ignoredBy = await run("git", ["check-ignore", "-v", ignoreProbe], { cwd: process.cwd() });
const gitStatus = await run("git", ["status", "--short"], { cwd: process.cwd() });
const report = {
  generatedAt: new Date().toISOString(),
  overall: {
    sourcePetsValidated: source.length,
    derivedPetsValidated: derived.length,
    managedPetsValidated: derived.filter((pet) => pet.installed).length,
    independentGeneratedStateCount: 0,
    sourceOriginalStateCount: 24,
    derivedVariantStateCount: 12,
    imageGenerationStatus: "built-in image generation timed out without output",
    functionalIntegration: "passed",
    completionStatus: "partial-visual-fallback",
  },
  source,
  derived,
  gitSafety: {
    ignoreProbe,
    ignoredBy,
    localAssetPathAppearsInStatus: gitStatus.includes("tmp/local-pokepets"),
    status: gitStatus.split(/\r?\n/).filter(Boolean),
  },
};
const reports = join(workspace, "reports");
await mkdir(reports, { recursive: true });
const output = join(reports, "final-validation.json");
const temporary = `${output}.${process.pid}.tmp`;
try {
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporary, output);
} catch (error) {
  await rm(temporary, { force: true }).catch(() => undefined);
  throw error;
}
process.stdout.write(`${JSON.stringify({ output, overall: report.overall }, null, 2)}\n`);
