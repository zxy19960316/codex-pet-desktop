import { isPetState, type PetState } from "./pet-state";
import type { PetImageFormat } from "./image-metadata";

export type { PetImageFormat } from "./image-metadata";

export type PetMetadataValue = string | number | boolean | null;

export interface PetAnimationDefinition {
  name: string;
  sprite: string;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop: boolean;
  format?: PetImageFormat;
  frameRow?: number;
  frames?: number;
}

export interface PetAssetManifest {
  sprites: string[];
  sounds?: string[];
}

export interface PetCapabilities {
  spriteSheet: true;
  sounds?: boolean;
}

export interface PetManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  license: string;
  preview: string;
  assets: PetAssetManifest;
  animations: Partial<Record<PetState, PetAnimationDefinition>>;
  capabilities: PetCapabilities;
  metadata: Record<string, PetMetadataValue>;
  fallbacks?: Partial<Record<PetState, PetState>>;
}

export type PetPackageOrigin = "builtin" | "user";

export interface PetAnimationAsset extends PetAnimationDefinition {
  spriteUrl: string;
  sheetWidth: number;
  sheetHeight: number;
  frames: number;
  frameRow?: number;
}

export interface PetPackage {
  manifest: PetManifest;
  origin: PetPackageOrigin;
  previewUrl: string;
  animations: Partial<Record<PetState, PetAnimationAsset>>;
}

export interface PetSummary {
  id: string;
  name: string;
  version: string;
  author: string;
  license: string;
  previewUrl: string;
  origin: PetPackageOrigin;
  active: boolean;
  previewAnimation?: PetAnimationAsset;
}

export interface PetPackageIssue {
  packageName: string;
  reason: string;
}

export interface PetRegistrySnapshot {
  active?: PetPackage;
  available: PetSummary[];
  issues: PetPackageIssue[];
}

export interface PetManifestValidationError {
  path: string;
  message: string;
}

export type PetManifestValidationResult =
  { ok: true; value: PetManifest } | { ok: false; errors: PetManifestValidationError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  errors: PetManifestValidationError[],
): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    errors.push({ path: key, message: "must be a non-empty string" });
    return "";
  }
  return value.trim();
}

function positiveNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: PetManifestValidationError[],
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    errors.push({ path: `${path}.${key}`, message: "must be a positive number" });
    return 1;
  }
  return value;
}

export function isSafePetAssetPath(value: string): boolean {
  if (!value || value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/.test(value))
    return false;
  const segments = value.split("/");
  return segments.every((segment) => Boolean(segment) && segment !== "." && segment !== "..");
}

function imageFormatForPath(value: string): PetImageFormat | undefined {
  const extension = value.toLowerCase().split(".").pop();
  return extension === "png" || extension === "webp" ? extension : undefined;
}

function assetPath(
  value: string,
  path: string,
  extensions: readonly string[],
  errors: PetManifestValidationError[],
): string {
  if (!isSafePetAssetPath(value)) errors.push({ path, message: "must be a safe relative path" });
  if (!extensions.some((extension) => value.toLowerCase().endsWith(extension)))
    errors.push({ path, message: `must reference a ${extensions.join(" or ")} file` });
  return value;
}

function stringArray(
  value: unknown,
  path: string,
  extension: string,
  errors: PetManifestValidationError[],
): string[] {
  if (!Array.isArray(value) || !value.length) {
    errors.push({ path, message: "must be a non-empty array" });
    return [];
  }
  const result: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || !entry.trim()) {
      errors.push({ path: `${path}.${index}`, message: "must be a non-empty string" });
      return;
    }
    result.push(assetPath(entry.trim(), `${path}.${index}`, [extension], errors));
  });
  if (new Set(result).size !== result.length)
    errors.push({ path, message: "must not contain duplicate paths" });
  return result;
}

function parseAnimations(
  value: unknown,
  sprites: ReadonlySet<string>,
  errors: PetManifestValidationError[],
): Partial<Record<PetState, PetAnimationDefinition>> {
  if (!isRecord(value)) {
    errors.push({ path: "animations", message: "must be an object" });
    return {};
  }
  const animations: Partial<Record<PetState, PetAnimationDefinition>> = {};
  for (const [stateName, animationValue] of Object.entries(value)) {
    const path = `animations.${stateName}`;
    if (!isPetState(stateName)) {
      errors.push({ path, message: "uses an unsupported pet state" });
      continue;
    }
    if (!isRecord(animationValue)) {
      errors.push({ path, message: "must be an object" });
      continue;
    }
    const name = requiredString(animationValue, "name", errors);
    const spriteValue = requiredString(animationValue, "sprite", errors);
    const sprite = assetPath(spriteValue, `${path}.sprite`, [".png", ".webp"], errors);
    if (sprite && !sprites.has(sprite))
      errors.push({ path: `${path}.sprite`, message: "must be declared in assets.sprites" });
    const frameWidth = positiveNumber(animationValue, "frameWidth", path, errors);
    const frameHeight = positiveNumber(animationValue, "frameHeight", path, errors);
    const fps = positiveNumber(animationValue, "fps", path, errors);
    const loop = animationValue.loop;
    if (typeof loop !== "boolean")
      errors.push({ path: `${path}.loop`, message: "must be a boolean" });
    const inferredFormat = imageFormatForPath(sprite);
    const format = animationValue.format;
    if (format !== undefined && format !== "png" && format !== "webp")
      errors.push({ path: `${path}.format`, message: "must be png or webp" });
    if (format !== undefined && inferredFormat && format !== inferredFormat)
      errors.push({ path: `${path}.format`, message: "must match the sprite extension" });
    const frameRow = animationValue.frameRow;
    if (frameRow !== undefined && (!Number.isInteger(frameRow) || (frameRow as number) < 0))
      errors.push({ path: `${path}.frameRow`, message: "must be a non-negative integer" });
    const frames = animationValue.frames;
    if (frames !== undefined && (!Number.isInteger(frames) || (frames as number) <= 0))
      errors.push({ path: `${path}.frames`, message: "must be a positive integer" });
    animations[stateName] = {
      name,
      sprite,
      frameWidth,
      frameHeight,
      fps,
      loop: typeof loop === "boolean" ? loop : false,
      format: format === "png" || format === "webp" ? format : inferredFormat,
      frameRow:
        typeof frameRow === "number" && Number.isInteger(frameRow) && frameRow >= 0
          ? frameRow
          : undefined,
      frames:
        typeof frames === "number" && Number.isInteger(frames) && frames > 0 ? frames : undefined,
    };
  }
  if (!animations.idle)
    errors.push({ path: "animations.idle", message: "is required as the final fallback" });
  return animations;
}

function parseFallbacks(
  value: unknown,
  errors: PetManifestValidationError[],
): Partial<Record<PetState, PetState>> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    errors.push({ path: "fallbacks", message: "must be an object" });
    return {};
  }
  const fallbacks: Partial<Record<PetState, PetState>> = {};
  for (const [from, to] of Object.entries(value)) {
    if (!isPetState(from)) {
      errors.push({ path: `fallbacks.${from}`, message: "uses an unsupported pet state" });
      continue;
    }
    if (!isPetState(to)) {
      errors.push({ path: `fallbacks.${from}`, message: "must reference a supported pet state" });
      continue;
    }
    fallbacks[from] = to;
  }
  return fallbacks;
}

function parseMetadata(
  value: unknown,
  errors: PetManifestValidationError[],
): Record<string, PetMetadataValue> {
  if (!isRecord(value)) {
    errors.push({ path: "metadata", message: "must be an object" });
    return {};
  }
  const metadata: Record<string, PetMetadataValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== null && !["string", "number", "boolean"].includes(typeof entry)) {
      errors.push({ path: `metadata.${key}`, message: "must be a primitive JSON value" });
      continue;
    }
    metadata[key] = entry as PetMetadataValue;
  }
  return metadata;
}

export function validatePetManifest(value: unknown): PetManifestValidationResult {
  if (!isRecord(value))
    return { ok: false, errors: [{ path: "manifest", message: "must be an object" }] };

  const errors: PetManifestValidationError[] = [];
  const id = requiredString(value, "id", errors);
  if (id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
    errors.push({ path: "id", message: "must use lowercase letters, numbers, and hyphens" });
  const name = requiredString(value, "name", errors);
  const version = requiredString(value, "version", errors);
  const author = requiredString(value, "author", errors);
  const license = requiredString(value, "license", errors);
  const preview = assetPath(
    requiredString(value, "preview", errors),
    "preview",
    [".png", ".webp"],
    errors,
  );

  let assets: PetAssetManifest = { sprites: [] };
  if (!isRecord(value.assets)) errors.push({ path: "assets", message: "must be an object" });
  else {
    const sprites = Array.isArray(value.assets.sprites)
      ? value.assets.sprites.map((entry, index) => {
          if (typeof entry !== "string" || !entry.trim()) {
            errors.push({
              path: `assets.sprites.${index}`,
              message: "must be a non-empty string",
            });
            return "";
          }
          return assetPath(entry.trim(), `assets.sprites.${index}`, [".png", ".webp"], errors);
        })
      : [];
    if (!Array.isArray(value.assets.sprites) || !value.assets.sprites.length)
      errors.push({ path: "assets.sprites", message: "must be a non-empty array" });
    if (new Set(sprites).size !== sprites.length)
      errors.push({ path: "assets.sprites", message: "must not contain duplicate paths" });
    const sounds =
      value.assets.sounds === undefined
        ? undefined
        : stringArray(value.assets.sounds, "assets.sounds", ".wav", errors);
    assets = { sprites, sounds };
  }

  const animations = parseAnimations(value.animations, new Set(assets.sprites), errors);
  let capabilities: PetCapabilities = { spriteSheet: true };
  if (!isRecord(value.capabilities))
    errors.push({ path: "capabilities", message: "must be an object" });
  else {
    if (value.capabilities.spriteSheet !== true)
      errors.push({ path: "capabilities.spriteSheet", message: "must be true for M3.1" });
    if (value.capabilities.sounds !== undefined && typeof value.capabilities.sounds !== "boolean")
      errors.push({ path: "capabilities.sounds", message: "must be a boolean" });
    capabilities = {
      spriteSheet: true,
      sounds:
        typeof value.capabilities.sounds === "boolean" ? value.capabilities.sounds : undefined,
    };
  }
  const metadata = parseMetadata(value.metadata, errors);
  const fallbacks = parseFallbacks(value.fallbacks, errors);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      name,
      version,
      author,
      license,
      preview,
      assets,
      animations,
      capabilities,
      metadata,
      fallbacks,
    },
  };
}

export function formatManifestErrors(errors: readonly PetManifestValidationError[]): string {
  return errors.map(({ path, message }) => `${path} ${message}`).join("; ");
}
