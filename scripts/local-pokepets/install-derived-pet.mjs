import { cp, lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import { option, parseArguments, validateDerivedPetDirectory } from "./local-pokepets-lib.mjs";

const { options, positional } = parseArguments(process.argv.slice(2));
const managed = resolve(
  option(options, "managed-dir", join(process.env.APPDATA ?? "", "Codex Pet Desktop", "pets")),
);
if (!managed || managed === resolve(""))
  throw new Error("--managed-dir is required when APPDATA is unavailable");
const derivedRoot = resolve(
  option(options, "derived-root", join(process.cwd(), "tmp", "local-pokepets", "derived")),
);
const directories = positional.length
  ? positional.map((value) => resolve(value))
  : ["pikachu", "charizard", "mew"].map((pet) => join(derivedRoot, `${pet}-local-12state`));
await mkdir(managed, { recursive: true });
const replace = options.get("replace") === true;
const results = [];
for (const source of directories) {
  const validation = await validateDerivedPetDirectory(source);
  const destination = join(managed, validation.id);
  let exists = false;
  try {
    const stats = await lstat(destination);
    if (!stats.isDirectory() || stats.isSymbolicLink())
      throw new Error(`${destination} is not a safe installed directory`);
    const installed = await validateDerivedPetDirectory(destination);
    if (installed.id !== validation.id)
      throw new Error(`Installed identity mismatch at ${destination}`);
    exists = true;
    if (!replace) {
      results.push({ id: validation.id, status: "already-installed", destination });
      continue;
    }
  } catch (error) {
    if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
  }
  const temporary = join(managed, `.install-${validation.id}-${process.pid}-${Date.now()}`);
  const backup = join(managed, `.backup-${validation.id}-${process.pid}-${Date.now()}`);
  try {
    await cp(source, temporary, { recursive: true, errorOnExist: true, force: false });
    await validateDerivedPetDirectory(temporary);
    if (exists) await rename(destination, backup);
    await rename(temporary, destination);
    if (exists) await rm(backup, { recursive: true, force: true });
    results.push({ id: validation.id, status: exists ? "replaced" : "installed", destination });
  } catch (error) {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
    if (exists) {
      try {
        await lstat(destination);
      } catch {
        await rename(backup, destination).catch(() => undefined);
      }
    }
    throw error;
  }
}
await writeFile(
  join(managed, ".local-12state-install.json"),
  `${JSON.stringify({ installedAt: new Date().toISOString(), pets: results }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
process.stdout.write(`${JSON.stringify({ managed, pets: results }, null, 2)}\n`);
