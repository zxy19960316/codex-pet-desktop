import { cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  formatManifestErrors,
  validatePetManifest,
  type PetAnimationAsset,
  type PetManifest,
  type PetPackage,
  type PetPackageIssue,
  type PetPackageOrigin,
  type PetRegistrySnapshot,
  type PetSummary,
} from "./pet-manifest";
import type { PetState } from "./pet-state";
import { readPetImageMetadata, type PetImageMetadata } from "./image-metadata";

const MANIFEST_FILENAME = "manifest.json";
const DEFAULT_STATE_FILENAME = ".active-pet.json";
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
const MAX_IMPORT_ENTRIES = 2_000;

export interface PetRegistryOptions {
  builtinDirectory: string;
  userDirectory: string;
  activePetId?: string;
  stateFile?: string;
}

export type PetValidationResult = { ok: true; value: PetPackage } | { ok: false; error: string };

function clonePackage(pet: PetPackage): PetPackage {
  return structuredClone(pet);
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

async function assertRegularFile(path: string, label: string): Promise<number> {
  let stats;
  try {
    stats = await lstat(path);
  } catch {
    throw new Error(`${label} is missing`);
  }
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (!stats.isFile()) throw new Error(`${label} must be a regular file`);
  if (stats.size > MAX_ASSET_BYTES) throw new Error(`${label} exceeds the 20 MB asset limit`);
  return stats.size;
}

async function readManifest(directory: string): Promise<unknown> {
  const path = join(directory, MANIFEST_FILENAME);
  const size = await assertRegularFile(path, MANIFEST_FILENAME);
  if (size > MAX_MANIFEST_BYTES) throw new Error("manifest.json exceeds the 1 MB limit");
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error(`manifest.json is invalid JSON: ${error.message}`, { cause: error });
    throw error;
  }
}

function assetPath(root: string, relativePath: string): string {
  const candidate = resolve(root, ...relativePath.split("/"));
  if (!isWithin(root, candidate)) throw new Error(`${relativePath} escapes the pet package`);
  return candidate;
}

async function loadAnimationAssets(
  root: string,
  manifest: PetManifest,
): Promise<Partial<Record<PetState, PetAnimationAsset>>> {
  const dimensions = new Map<string, PetImageMetadata>();
  for (const sprite of manifest.assets.sprites) {
    dimensions.set(sprite, await readPetImageMetadata(assetPath(root, sprite), sprite));
  }
  const animations: Partial<Record<PetState, PetAnimationAsset>> = {};
  for (const [stateName, animation] of Object.entries(manifest.animations) as [
    PetState,
    NonNullable<PetManifest["animations"][PetState]>,
  ][]) {
    const size = dimensions.get(animation.sprite);
    if (!size) throw new Error(`${animation.sprite} was not validated`);
    if (size.width % animation.frameWidth !== 0)
      throw new Error(
        `${animation.sprite} width ${size.width} is not divisible by frameWidth ${animation.frameWidth}`,
      );
    const columns = size.width / animation.frameWidth;
    const frameRow = animation.frameRow ?? 0;
    if (animation.frameRow === undefined && size.height !== animation.frameHeight)
      throw new Error(
        `${animation.sprite} height ${size.height} does not match frameHeight ${animation.frameHeight}`,
      );
    if (animation.frameRow !== undefined && size.height % animation.frameHeight !== 0)
      throw new Error(
        `${animation.sprite} height ${size.height} is not divisible by frameHeight ${animation.frameHeight}`,
      );
    const rows = size.height / animation.frameHeight;
    if (frameRow >= rows)
      throw new Error(`${animation.sprite} frameRow ${frameRow} is outside ${rows} row(s)`);
    const frames = animation.frames ?? columns;
    if (frames > columns)
      throw new Error(`${animation.sprite} requests ${frames} frames but has ${columns} column(s)`);
    animations[stateName] = {
      ...animation,
      format: size.format,
      spriteUrl: pathToFileURL(assetPath(root, animation.sprite)).href,
      sheetWidth: size.width,
      sheetHeight: size.height,
      frames,
      frameRow,
    };
  }
  return animations;
}

async function assertOptionalSounds(root: string, manifest: PetManifest): Promise<void> {
  for (const sound of manifest.assets.sounds ?? [])
    await assertRegularFile(assetPath(root, sound), sound);
}

async function assertImportTreeSafe(root: string): Promise<void> {
  let entries = 0;
  let bytes = 0;
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      entries += 1;
      if (entries > MAX_IMPORT_ENTRIES)
        throw new Error(`Pet package exceeds the ${MAX_IMPORT_ENTRIES} entry limit`);
      const path = join(directory, entry.name);
      const stats = await lstat(path);
      if (stats.isSymbolicLink())
        throw new Error(`Pet package contains a symbolic link: ${entry.name}`);
      if (stats.isDirectory()) await visit(path);
      else if (stats.isFile()) {
        bytes += stats.size;
        if (bytes > MAX_IMPORT_BYTES)
          throw new Error("Pet package exceeds the 100 MB import limit");
      } else throw new Error(`Pet package contains an unsupported filesystem entry: ${entry.name}`);
    }
  };
  await visit(root);
}

export class PetRegistry {
  readonly #builtinDirectory: string;
  readonly #userDirectory: string;
  readonly #stateFile: string;
  readonly #fallbackPetId?: string;
  #activePetId?: string;
  #pets = new Map<string, PetPackage>();
  #issues: PetPackageIssue[] = [];

  constructor(options: PetRegistryOptions) {
    this.#builtinDirectory = resolve(options.builtinDirectory);
    this.#userDirectory = resolve(options.userDirectory);
    this.#stateFile = resolve(
      options.stateFile ?? join(this.#userDirectory, DEFAULT_STATE_FILENAME),
    );
    this.#fallbackPetId = options.activePetId;
    this.#activePetId = options.activePetId;
  }

  get userDirectory(): string {
    return this.#userDirectory;
  }

  async scan(): Promise<PetRegistrySnapshot> {
    await mkdir(this.#userDirectory, { recursive: true });
    const persisted = await this.#readActivePetId();
    if (persisted) this.#activePetId = persisted;
    const pets = new Map<string, PetPackage>();
    const issues: PetPackageIssue[] = [];
    await this.#scanRoot(this.#builtinDirectory, "builtin", pets, issues);
    await this.#scanRoot(this.#userDirectory, "user", pets, issues);
    this.#pets = pets;
    this.#issues = issues;
    this.#ensureActivePet();
    return this.getSnapshot();
  }

  getAvailablePets(): PetSummary[] {
    return [...this.#pets.values()]
      .map((pet) => ({
        id: pet.manifest.id,
        name: pet.manifest.name,
        version: pet.manifest.version,
        author: pet.manifest.author,
        license: pet.manifest.license,
        previewUrl: pet.previewUrl,
        origin: pet.origin,
        active: pet.manifest.id === this.#activePetId,
        previewAnimation: pet.animations.idle ? structuredClone(pet.animations.idle) : undefined,
      }))
      .sort(
        (left, right) =>
          Number(right.active) - Number(left.active) || left.name.localeCompare(right.name),
      );
  }

  getPet(id: string): PetPackage | undefined {
    const pet = this.#pets.get(id);
    return pet ? clonePackage(pet) : undefined;
  }

  getActivePet(): PetPackage | undefined {
    this.#ensureActivePet();
    return this.#activePetId ? this.getPet(this.#activePetId) : undefined;
  }

  getSnapshot(): PetRegistrySnapshot {
    return {
      active: this.getActivePet(),
      available: this.getAvailablePets(),
      issues: this.#issues.map((issue) => ({ ...issue })),
    };
  }

  async setActivePet(id: string): Promise<PetPackage> {
    const pet = this.#pets.get(id);
    if (!pet) throw new Error(`Pet "${id}" is not available`);
    this.#activePetId = id;
    await this.#writeActivePetId(id);
    return clonePackage(pet);
  }

  async validatePet(
    directory: string,
    origin: PetPackageOrigin = "user",
  ): Promise<PetValidationResult> {
    const root = resolve(directory);
    try {
      const rootStats = await lstat(root);
      if (rootStats.isSymbolicLink())
        throw new Error("Pet package directory must not be a symbolic link");
      if (!rootStats.isDirectory()) throw new Error("Pet package path must be a directory");
      const parsed = validatePetManifest(await readManifest(root));
      if (!parsed.ok) throw new Error(`Invalid manifest: ${formatManifestErrors(parsed.errors)}`);
      const previewPath = assetPath(root, parsed.value.preview);
      await readPetImageMetadata(previewPath, parsed.value.preview);
      await assertOptionalSounds(root, parsed.value);
      const animations = await loadAnimationAssets(root, parsed.value);
      return {
        ok: true,
        value: {
          manifest: parsed.value,
          origin,
          previewUrl: pathToFileURL(previewPath).href,
          animations,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown pet validation error",
      };
    }
  }

  async importPetPackage(sourceDirectory: string): Promise<PetPackage> {
    const source = resolve(sourceDirectory);
    if (isWithin(this.#userDirectory, source))
      throw new Error("Choose a pet package outside the managed user pet directory");
    await assertImportTreeSafe(source);
    const sourceValidation = await this.validatePet(source, "user");
    if (!sourceValidation.ok) throw new Error(sourceValidation.error);
    const id = sourceValidation.value.manifest.id;
    if (this.#pets.has(id)) throw new Error(`Pet "${id}" is already installed`);
    const destination = join(this.#userDirectory, id);
    const temporary = join(this.#userDirectory, `.import-${id}-${Date.now()}`);
    if (!isWithin(this.#userDirectory, destination) || !isWithin(this.#userDirectory, temporary))
      throw new Error("Import destination is outside the managed pet directory");
    try {
      try {
        await lstat(destination);
        throw new Error(`Pet "${id}" is already installed`);
      } catch (error) {
        if (error instanceof Error && !error.message.includes("ENOENT")) throw error;
      }
      await cp(source, temporary, { recursive: true, errorOnExist: true, force: false });
      const copiedValidation = await this.validatePet(temporary, "user");
      if (!copiedValidation.ok)
        throw new Error(`Copied pet package is invalid: ${copiedValidation.error}`);
      await rename(temporary, destination);
      await this.scan();
      const imported = this.getPet(id);
      if (!imported) throw new Error(`Pet "${id}" could not be loaded after import`);
      return imported;
    } catch (error) {
      await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  async #scanRoot(
    root: string,
    origin: PetPackageOrigin,
    pets: Map<string, PetPackage>,
    issues: PetPackageIssue[],
  ): Promise<void> {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch (error) {
      if (origin === "builtin")
        issues.push({
          packageName: basename(root),
          reason: `Pet directory is unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const validation = await this.validatePet(join(root, entry.name), origin);
      if (!validation.ok) {
        issues.push({ packageName: entry.name, reason: validation.error });
        continue;
      }
      const id = validation.value.manifest.id;
      if (pets.has(id)) {
        issues.push({ packageName: entry.name, reason: `Duplicate pet id "${id}" was ignored` });
        continue;
      }
      pets.set(id, validation.value);
    }
  }

  #ensureActivePet(): void {
    if (this.#activePetId && this.#pets.has(this.#activePetId)) return;
    if (this.#fallbackPetId && this.#pets.has(this.#fallbackPetId))
      this.#activePetId = this.#fallbackPetId;
    else this.#activePetId = this.#pets.keys().next().value;
  }

  async #readActivePetId(): Promise<string | undefined> {
    try {
      const stats = await lstat(this.#stateFile);
      if (stats.isSymbolicLink() || !stats.isFile() || stats.size > 4_096) return undefined;
      const value = JSON.parse(await readFile(this.#stateFile, "utf8")) as unknown;
      if (!value || typeof value !== "object" || !("id" in value)) return undefined;
      return typeof value.id === "string" ? value.id : undefined;
    } catch {
      return undefined;
    }
  }

  async #writeActivePetId(id: string): Promise<void> {
    await mkdir(dirname(this.#stateFile), { recursive: true });
    const temporary = `${this.#stateFile}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ id })}\n`, { encoding: "utf8", mode: 0o600 });
    try {
      await rename(temporary, this.#stateFile);
    } catch {
      await rm(this.#stateFile, { force: true });
      await rename(temporary, this.#stateFile);
    }
  }
}
