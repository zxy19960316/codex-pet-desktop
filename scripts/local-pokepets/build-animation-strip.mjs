import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import {
  REQUIRED_STATES,
  STATE_SPECS,
  assertAllowedPet,
  assertInsideRoot,
  option,
  parseArguments,
  validateDerivedPetDirectory,
} from "./local-pokepets-lib.mjs";

const DISPLAY_NAMES = { pikachu: "Pikachu", charizard: "Charizard", mew: "Mew" };
const CLASSIFICATIONS = new Set(["source-original", "independent-generated", "derived-variant"]);

function pythonTool() {
  return fileURLToPath(new URL("./image-tools.py", import.meta.url));
}

function runPython(arguments_) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("python", [pythonTool(), ...arguments_], {
      stdio: ["ignore", "pipe", "pipe"],
    });
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
        : reject(new Error(stderr.trim() || `Python exited ${code}`)),
    );
  });
}

async function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

function initialManifest(pet) {
  return {
    id: `${pet}-local-12state`,
    name: `${DISPLAY_NAMES[pet]} Local 12-State`,
    version: "1.0.0-local",
    author: "Local personal derivative",
    license: "Third-party fan asset; personal local use only; redistribution prohibited",
    preview: "preview.webp",
    assets: { sprites: ["source-atlas.webp"] },
    animations: {},
    capabilities: { spriteSheet: true, sounds: false },
    metadata: {
      sourceProject: "dnnyngyen/codex-pokepets",
      sourcePetId: pet,
      locallyDerived: true,
      redistributionAllowed: false,
      localPersonalUseOnly: true,
      independentGeneratedStates: "",
      derivedVariantStates: "",
      sourceOriginalStates: "",
      sharedStates: "",
    },
  };
}

function updateClassification(manifest, report) {
  const groups = {
    "independent-generated": [],
    "derived-variant": [],
    "source-original": [],
  };
  for (const state of REQUIRED_STATES) {
    const entry = report.states[state];
    if (entry) groups[entry.classification].push(state);
  }
  manifest.metadata.independentGeneratedStates = groups["independent-generated"].join(",");
  manifest.metadata.derivedVariantStates = groups["derived-variant"].join(",");
  manifest.metadata.sourceOriginalStates = groups["source-original"].join(",");
}

const { options } = parseArguments(process.argv.slice(2));
const workspace = resolve(
  option(options, "workspace", join(process.cwd(), "tmp", "local-pokepets")),
);
const pet = assertAllowedPet(option(options, "pet", ""));
const derivedRoot = assertInsideRoot(workspace, join(workspace, "derived"));
const directory = assertInsideRoot(derivedRoot, join(derivedRoot, `${pet}-local-12state`));
const finalize = options.get("finalize") === true;
await mkdir(directory, { recursive: true });

if (finalize) {
  const validation = await validateDerivedPetDirectory(directory);
  const qa = assertInsideRoot(workspace, join(workspace, "qa", `${pet}-local-12state`));
  await mkdir(qa, { recursive: true });
  await runPython([
    "contact-sheet",
    "--directory",
    directory,
    "--out",
    join(qa, "contact-sheet.png"),
  ]);
  await runPython([
    "animated-preview",
    "--directory",
    directory,
    "--out",
    join(qa, "preview.webp"),
  ]);
  process.stdout.write(`${JSON.stringify({ ...validation, qa }, null, 2)}\n`);
  process.exit(0);
}

const state = option(options, "state", "");
if (!REQUIRED_STATES.includes(state))
  throw new Error(`--state must be one of ${REQUIRED_STATES.join(", ")}`);
const classification = option(options, "classification", "");
if (!CLASSIFICATIONS.has(classification))
  throw new Error(
    "--classification must be source-original, independent-generated, or derived-variant",
  );
const sourceAtlas = resolve(option(options, "source-atlas", ""));
if (!sourceAtlas) throw new Error("--source-atlas is required");
const input = option(options, "input", undefined);
const sourceRowValue = option(options, "source-row", undefined);
const sourceRow = sourceRowValue === undefined ? undefined : Number(sourceRowValue);
if (sourceRow !== undefined && (!Number.isInteger(sourceRow) || sourceRow < 0 || sourceRow > 8))
  throw new Error("--source-row must be an integer from 0 to 8");
if (!input && sourceRow === undefined) throw new Error("--input or --source-row is required");
const spec = STATE_SPECS[state];
const sprite = `${state.replaceAll("_", "-")}.webp`;
const output = join(directory, sprite);
const temporary = `${output}.${process.pid}.${Date.now()}.tmp.webp`;
const reportPath = join(directory, "generation-report.json");
const manifestPath = join(directory, "manifest.json");
let manifest;
let report;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {
  manifest = initialManifest(pet);
}
try {
  report = JSON.parse(await readFile(reportPath, "utf8"));
} catch {
  report = { pet, states: {} };
}
if (!manifest.assets.sprites.includes("source-atlas.webp"))
  manifest.assets.sprites.unshift("source-atlas.webp");
try {
  await readFile(join(directory, "source-atlas.webp"));
} catch {
  await copyFile(sourceAtlas, join(directory, "source-atlas.webp"));
}

try {
  if (sourceRow !== undefined)
    await runPython([
      "source-strip",
      "--atlas",
      sourceAtlas,
      "--out",
      temporary,
      "--row",
      String(sourceRow),
      "--frames",
      String(spec.frames),
    ]);
  else {
    await runPython(["alpha-stats", "--input", resolve(input)]);
    const arguments_ = [
      "strip",
      "--input",
      resolve(input),
      "--out",
      temporary,
      "--state",
      state,
      "--frames",
      String(spec.frames),
    ];
    if (pet === "mew") arguments_.push("--floating");
    await runPython(arguments_);
  }
  await rename(temporary, output);
} catch (error) {
  await rm(temporary, { force: true }).catch(() => undefined);
  throw error;
}
if (!manifest.assets.sprites.includes(sprite)) manifest.assets.sprites.push(sprite);
manifest.animations[state] = {
  name: state,
  sprite,
  format: "webp",
  frameWidth: 192,
  frameHeight: 208,
  frameRow: 0,
  frames: spec.frames,
  fps: spec.fps,
  loop: true,
};
report.states[state] = {
  classification,
  sprite,
  frames: spec.frames,
  fps: spec.fps,
  input: input ? basename(input) : `source-atlas.webp row ${sourceRow}`,
  sourceState: option(options, "source-state", undefined),
};
updateClassification(manifest, report);
if (state === "idle")
  await runPython(["first-frame", "--input", output, "--out", join(directory, "preview.webp")]);
await atomicJson(manifestPath, manifest);
await atomicJson(reportPath, report);
process.stdout.write(
  `${JSON.stringify({ pet, state, output, classification, frames: spec.frames, fps: spec.fps }, null, 2)}\n`,
);
