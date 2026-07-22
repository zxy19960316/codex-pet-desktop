import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { join, resolve } from "node:path";
import process from "node:process";
import {
  ALLOWED_PETS,
  assertAllowedPet,
  assertInsideRoot,
  option,
  parseArguments,
  validateSourcePetDirectory,
} from "./local-pokepets-lib.mjs";

const RAW_ROOT = "https://raw.githubusercontent.com/dnnyngyen/codex-pokepets/main/pets";
const REQUIRED_FILES = ["pet.json", "spritesheet.webp", "preview.gif"];
const { options, positional } = parseArguments(process.argv.slice(2));
const workspace = resolve(
  option(options, "workspace", join(process.cwd(), "tmp", "local-pokepets")),
);
const sourceRoot = assertInsideRoot(workspace, join(workspace, "source"));
const pets = positional.length ? positional.map(assertAllowedPet) : [...ALLOWED_PETS];

async function existingNonempty(path) {
  try {
    return (await stat(path)).isFile() && (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function download(url, destination) {
  if (await existingNonempty(destination)) return "preserved";
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  try {
    const response = await globalThis.fetch(url, { redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    await writeFile(temporary, Buffer.from(await response.arrayBuffer()), { flag: "wx" });
    await rename(temporary, destination);
    return "downloaded";
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

const results = [];
await mkdir(sourceRoot, { recursive: true });
for (const pet of pets) {
  const directory = assertInsideRoot(sourceRoot, join(sourceRoot, pet));
  await mkdir(directory, { recursive: true });
  const files = {};
  for (const name of REQUIRED_FILES)
    files[name] = await download(`${RAW_ROOT}/${pet}/${name}`, join(directory, name));
  const validation = await validateSourcePetDirectory(directory, pet);
  const sourceManifest = JSON.parse(await readFile(join(directory, "pet.json"), "utf8"));
  results.push({ ...validation, sourceManifest, directory, files });
}
process.stdout.write(`${JSON.stringify({ workspace, pets: results }, null, 2)}\n`);
