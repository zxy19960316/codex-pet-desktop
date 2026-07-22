import { join, resolve } from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import {
  ALLOWED_PETS,
  assertAllowedPet,
  assertInsideRoot,
  option,
  parseArguments,
  validateSourcePetDirectory,
} from "./local-pokepets-lib.mjs";

function runPython(arguments_) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("python", arguments_, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (value) => (stderr += value));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolvePromise() : reject(new Error(stderr.trim() || `Python exited ${code}`)),
    );
  });
}

const { options, positional } = parseArguments(process.argv.slice(2));
const workspace = resolve(
  option(options, "workspace", join(process.cwd(), "tmp", "local-pokepets")),
);
const sourceRoot = assertInsideRoot(workspace, join(workspace, "source"));
const pets = positional.length ? positional.map(assertAllowedPet) : [...ALLOWED_PETS];
const imageTools = fileURLToPath(new URL("./image-tools.py", import.meta.url));
const results = [];
for (const pet of pets) {
  const directory = assertInsideRoot(sourceRoot, join(sourceRoot, pet));
  const validation = await validateSourcePetDirectory(directory, pet);
  await runPython([
    imageTools,
    "verify",
    "--input",
    join(directory, "spritesheet.webp"),
    "--input",
    join(directory, "preview.gif"),
  ]);
  results.push({ ...validation, directory, pillowDecoded: true });
}
process.stdout.write(`${JSON.stringify({ ok: true, pets: results }, null, 2)}\n`);
