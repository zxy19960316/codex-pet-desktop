import { lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import { option, parseArguments, validateDerivedPetDirectory } from "./local-pokepets-lib.mjs";

const ALLOWED_IDS = new Set([
  "pixel-sprout",
  "pikachu-local-12state",
  "charizard-local-12state",
  "mew-local-12state",
]);
const { options, positional } = parseArguments(process.argv.slice(2));
const id = positional[0];
if (!ALLOWED_IDS.has(id)) throw new Error(`Unsupported installed pet id: ${String(id)}`);
const managed = resolve(
  option(options, "managed-dir", join(process.env.APPDATA ?? "", "Codex Pet Desktop", "pets")),
);
if (id !== "pixel-sprout") await validateDerivedPetDirectory(join(managed, id));
await mkdir(managed, { recursive: true });
const stateFile = join(managed, ".active-pet.json");
try {
  const stats = await lstat(stateFile);
  if (stats.isSymbolicLink() || !stats.isFile())
    throw new Error("Active pet state is not a regular file");
} catch (error) {
  if (error && typeof error === "object" && error.code !== "ENOENT") throw error;
}
const temporary = `${stateFile}.${process.pid}.${Date.now()}.tmp`;
try {
  await writeFile(temporary, `${JSON.stringify({ id })}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await rename(temporary, stateFile);
} catch (error) {
  await rm(temporary, { force: true }).catch(() => undefined);
  throw error;
}
process.stdout.write(`${JSON.stringify({ id, stateFile }, null, 2)}\n`);
