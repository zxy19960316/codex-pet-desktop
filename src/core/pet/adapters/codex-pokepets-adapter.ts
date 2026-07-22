import { copyFile, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ExternalPetAdapter } from "../external-pet-adapter";
import { readPetImageMetadata } from "../image-metadata";
import { isSafePetAssetPath, type PetAnimationDefinition, type PetManifest } from "../pet-manifest";
import type { PetRegistry } from "../pet-registry";
import type { PetState } from "../pet-state";
import type { CodexPokePetJson, CodexPokePetSource } from "./codex-pokepets-types";

const SOURCE_PROJECT = "dnnyngyen/codex-pokepets";
const SOURCE_MANIFEST = "pet.json";
const CANONICAL_SPRITE = "spritesheet.webp";
const SOURCE_ATLAS = { width: 1536, height: 1872, frameWidth: 192, frameHeight: 208 } as const;
const MAX_SOURCE_MANIFEST_BYTES = 1024 * 1024;

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

async function regularFile(path: string, label: string): Promise<number> {
  let stats;
  try {
    stats = await lstat(path);
  } catch {
    throw new Error(`${label} is missing`);
  }
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (!stats.isFile()) throw new Error(`${label} must be a regular file`);
  return stats.size;
}

function sourceJson(value: unknown, folderName: string): CodexPokePetJson {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("pet.json must be an object");
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id))
    throw new Error("pet.json id must be a canonical local pet id");
  if (record.id !== folderName) throw new Error("pet.json id must match its local folder name");
  if (
    typeof record.displayName !== "string" ||
    !record.displayName.trim() ||
    record.displayName.length > 120
  )
    throw new Error("pet.json displayName must be between 1 and 120 characters");
  if (
    record.description !== undefined &&
    (typeof record.description !== "string" || record.description.length > 2_000)
  )
    throw new Error("pet.json description must be a string no longer than 2000 characters");
  if (
    typeof record.spritesheetPath !== "string" ||
    !isSafePetAssetPath(record.spritesheetPath) ||
    !record.spritesheetPath.toLowerCase().endsWith(".webp")
  )
    throw new Error("pet.json spritesheetPath must be a safe relative WebP path");
  return {
    id: record.id,
    displayName: record.displayName.trim(),
    description: typeof record.description === "string" ? record.description.trim() : undefined,
    spritesheetPath: record.spritesheetPath,
  };
}

function animation(
  name: string,
  frameRow: number,
  frames: number,
  fps: number,
): PetAnimationDefinition {
  return {
    name,
    sprite: CANONICAL_SPRITE,
    format: "webp",
    frameWidth: SOURCE_ATLAS.frameWidth,
    frameHeight: SOURCE_ATLAS.frameHeight,
    frameRow,
    frames,
    fps,
    loop: true,
  };
}

function canonicalAnimations(): Partial<Record<PetState, PetAnimationDefinition>> {
  return {
    idle: animation("idle", 0, 6, 6),
    thinking: animation("review", 8, 6, 6),
    typing: animation("running", 7, 6, 8),
    working: animation("running", 7, 6, 8),
    approval: animation("waiting", 6, 6, 6),
    waiting_input: animation("waiting", 6, 6, 6),
    success: animation("jumping", 4, 5, 6),
    error: animation("failed", 5, 8, 6),
    quota_low: animation("waiting", 6, 6, 6),
    quota_empty: animation("failed", 5, 8, 6),
    offline: animation("failed", 5, 8, 6),
    sleep: animation("idle", 0, 6, 4),
  };
}

export function canonicalCodexPokePetId(sourcePetId: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourcePetId)) throw new Error("Invalid source pet id");
  return `codex-pokepets-${sourcePetId}`;
}

export class CodexPokePetsAdapter implements ExternalPetAdapter<CodexPokePetSource> {
  readonly id = "codex-pokepets";
  readonly #registry: PetRegistry;

  constructor(registry: PetRegistry) {
    this.#registry = registry;
  }

  async inspect(sourceDirectory: string): Promise<CodexPokePetSource> {
    const root = resolve(sourceDirectory);
    let rootStats;
    try {
      rootStats = await lstat(root);
    } catch {
      throw new Error("Local pet directory is missing");
    }
    if (rootStats.isSymbolicLink()) throw new Error("Local pet directory must not be a symlink");
    if (!rootStats.isDirectory()) throw new Error("Local pet source must be a directory");

    const manifestPath = join(root, SOURCE_MANIFEST);
    const size = await regularFile(manifestPath, SOURCE_MANIFEST);
    if (size > MAX_SOURCE_MANIFEST_BYTES) throw new Error("pet.json exceeds the 1 MB limit");
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new Error("pet.json contains invalid JSON", { cause: error });
      throw error;
    }
    const manifest = sourceJson(parsed, basename(root));
    const spritePath = resolve(root, ...manifest.spritesheetPath.split("/"));
    if (!isWithin(root, spritePath))
      throw new Error("spritesheetPath escapes the local pet folder");
    const image = await readPetImageMetadata(spritePath, manifest.spritesheetPath);
    if (
      image.format !== "webp" ||
      image.width !== SOURCE_ATLAS.width ||
      image.height !== SOURCE_ATLAS.height
    )
      throw new Error(
        `spritesheet.webp must use the Codex ${SOURCE_ATLAS.width} x ${SOURCE_ATLAS.height} atlas`,
      );
    return {
      sourcePetId: manifest.id,
      displayName: manifest.displayName,
      description: manifest.description,
      sourceDirectory: root,
      spritesheetPath: spritePath,
    };
  }

  async canAdapt(source: CodexPokePetSource | string): Promise<boolean> {
    try {
      if (typeof source === "string") await this.inspect(source);
      else await this.inspect(source.sourceDirectory);
      return true;
    } catch {
      return false;
    }
  }

  async adapt(source: CodexPokePetSource, destination: string): Promise<PetManifest> {
    const verified = await this.inspect(source.sourceDirectory);
    if (verified.sourcePetId !== source.sourcePetId)
      throw new Error("Local pet identity changed during import");
    const manifest: PetManifest = {
      id: canonicalCodexPokePetId(verified.sourcePetId),
      name: verified.displayName,
      version: "local-import",
      author: "Third-party local asset",
      license: "Third-party fan asset; see upstream source notice; not covered by project MIT",
      preview: CANONICAL_SPRITE,
      assets: { sprites: [CANONICAL_SPRITE] },
      animations: canonicalAnimations(),
      capabilities: { spriteSheet: true, sounds: false },
      metadata: {
        sourceProject: SOURCE_PROJECT,
        sourcePetId: verified.sourcePetId,
        redistributionAllowed: false,
        locallyImported: true,
        ...(verified.description ? { description: verified.description } : {}),
      },
    };
    await mkdir(destination, { recursive: false });
    await copyFile(verified.spritesheetPath, join(destination, CANONICAL_SPRITE));
    await writeFile(join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    return manifest;
  }

  async import(source: CodexPokePetSource): Promise<import("../pet-manifest").PetPackage> {
    const id = canonicalCodexPokePetId(source.sourcePetId);
    if (this.#registry.getPet(id)) throw new Error(`Pet "${id}" is already installed`);
    const destination = join(this.#registry.userDirectory, id);
    const temporary = join(this.#registry.userDirectory, `.adapt-${id}-${randomUUID()}`);
    await mkdir(this.#registry.userDirectory, { recursive: true });
    try {
      try {
        await lstat(destination);
        throw new Error(`Pet "${id}" is already installed`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await this.adapt(source, temporary);
      const validation = await this.#registry.validatePet(temporary, "user");
      if (!validation.ok) throw new Error(`Adapted pet package is invalid: ${validation.error}`);
      await rename(temporary, destination);
      await this.#registry.scan();
      await this.#registry.setActivePet(id);
      const imported = this.#registry.getPet(id);
      if (!imported) throw new Error(`Pet "${id}" was not available after import`);
      return imported;
    } catch (error) {
      await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }
}
