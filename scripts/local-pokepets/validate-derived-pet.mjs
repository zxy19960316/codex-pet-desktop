import { join, resolve } from "node:path";
import process from "node:process";
import { option, parseArguments, validateDerivedPetDirectory } from "./local-pokepets-lib.mjs";

const { options, positional } = parseArguments(process.argv.slice(2));
const derivedRoot = resolve(
  option(options, "derived-root", join(process.cwd(), "tmp", "local-pokepets", "derived")),
);
const directories = positional.length
  ? positional.map((value) => resolve(value))
  : ["pikachu", "charizard", "mew"].map((pet) => join(derivedRoot, `${pet}-local-12state`));
const pets = [];
const ids = new Set();
for (const directory of directories) {
  const result = await validateDerivedPetDirectory(directory);
  if (ids.has(result.id)) throw new Error(`Duplicate derived pet id: ${result.id}`);
  ids.add(result.id);
  pets.push({ ...result, directory });
}
process.stdout.write(`${JSON.stringify({ ok: true, pets }, null, 2)}\n`);
