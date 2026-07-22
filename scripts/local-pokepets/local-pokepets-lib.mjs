import { lstat, readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const ALLOWED_PETS = Object.freeze(["pikachu", "charizard", "mew"]);
export const REQUIRED_STATES = Object.freeze([
  "idle",
  "thinking",
  "typing",
  "working",
  "approval",
  "waiting_input",
  "success",
  "error",
  "quota_low",
  "quota_empty",
  "offline",
  "sleep",
]);

export const STATE_SPECS = Object.freeze({
  idle: { frames: 6, fps: 5 },
  thinking: { frames: 6, fps: 5 },
  typing: { frames: 8, fps: 10 },
  working: { frames: 8, fps: 8 },
  approval: { frames: 6, fps: 6 },
  waiting_input: { frames: 6, fps: 4 },
  success: { frames: 8, fps: 8 },
  error: { frames: 6, fps: 6 },
  quota_low: { frames: 6, fps: 5 },
  quota_empty: { frames: 6, fps: 4 },
  offline: { frames: 4, fps: 3 },
  sleep: { frames: 6, fps: 3 },
});

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;

export function assertAllowedPet(value) {
  if (!ALLOWED_PETS.includes(value))
    throw new Error(`Pet "${value}" is not allow-listed; expected ${ALLOWED_PETS.join(", ")}`);
  return value;
}

export function assertInsideRoot(root, candidate) {
  const safeRoot = resolve(root);
  const safeCandidate = resolve(candidate);
  const child = relative(safeRoot, safeCandidate);
  if (child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child))
    throw new Error(`Path is outside the local workspace: ${safeCandidate}`);
  return safeCandidate;
}

export function isSafeAssetPath(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.startsWith("/"))
    return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  return value.split("/").every((part) => part && part !== "." && part !== "..");
}

export function parseArguments(argv) {
  const options = new Map();
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) options.set(key, true);
    else {
      options.set(key, next);
      index += 1;
    }
  }
  return { options, positional };
}

export function option(options, key, fallback) {
  const value = options.get(key);
  return typeof value === "string" ? value : fallback;
}

async function assertRegularFile(path, label, maxBytes = MAX_IMAGE_BYTES) {
  let stats;
  try {
    stats = await lstat(path);
  } catch {
    throw new Error(`${label} is missing`);
  }
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (!stats.isFile()) throw new Error(`${label} must be a regular file`);
  if (stats.size > maxBytes) throw new Error(`${label} exceeds the file size limit`);
  return stats.size;
}

function positiveDimensions(format, width, height, label) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0)
    throw new Error(`${label} has invalid image dimensions`);
  return { format, width, height };
}

function readPng(buffer, label) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return undefined;
  if (buffer.toString("ascii", 12, 16) !== "IHDR")
    throw new Error(`${label} has an invalid PNG header`);
  return positiveDimensions("png", buffer.readUInt32BE(16), buffer.readUInt32BE(20), label);
}

function readGif(buffer, label) {
  if (buffer.length < 10 || !["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6)))
    return undefined;
  return positiveDimensions("gif", buffer.readUInt16LE(6), buffer.readUInt16LE(8), label);
}

function readWebp(buffer, label) {
  if (
    buffer.length < 20 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  )
    return undefined;
  const declaredLength = buffer.readUInt32LE(4) + 8;
  if (declaredLength > buffer.length || declaredLength < 20)
    throw new Error(`${label} has a truncated WebP container`);
  let offset = 12;
  while (offset + 8 <= declaredLength) {
    const kind = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    const end = data + length;
    if (end > declaredLength) throw new Error(`${label} has a truncated WebP chunk`);
    if (kind === "VP8X") {
      if (length < 10) throw new Error(`${label} has an invalid VP8X header`);
      return positiveDimensions(
        "webp",
        buffer.readUIntLE(data + 4, 3) + 1,
        buffer.readUIntLE(data + 7, 3) + 1,
        label,
      );
    }
    if (kind === "VP8L") {
      if (length < 5 || buffer[data] !== 0x2f)
        throw new Error(`${label} has an invalid VP8L header`);
      const packed = buffer.readUInt32LE(data + 1);
      return positiveDimensions(
        "webp",
        (packed & 0x3fff) + 1,
        ((packed >>> 14) & 0x3fff) + 1,
        label,
      );
    }
    if (kind === "VP8 ") {
      if (
        length < 10 ||
        buffer[data + 3] !== 0x9d ||
        buffer[data + 4] !== 0x01 ||
        buffer[data + 5] !== 0x2a
      )
        throw new Error(`${label} has an invalid VP8 header`);
      return positiveDimensions(
        "webp",
        buffer.readUInt16LE(data + 6) & 0x3fff,
        buffer.readUInt16LE(data + 8) & 0x3fff,
        label,
      );
    }
    offset = end + (length % 2);
  }
  throw new Error(`${label} has no supported WebP image chunk`);
}

export async function readImageMetadata(path) {
  await assertRegularFile(path, path);
  const buffer = await readFile(path);
  const metadata = readPng(buffer, path) ?? readGif(buffer, path) ?? readWebp(buffer, path);
  if (!metadata) throw new Error(`${path} is not a supported PNG, GIF, or WebP image`);
  return metadata;
}

export async function validateSourcePetDirectory(directory, expectedId) {
  assertAllowedPet(expectedId);
  const root = resolve(directory);
  const rootStats = await lstat(root);
  if (rootStats.isSymbolicLink())
    throw new Error("Source pet directory must not be a symbolic link");
  if (!rootStats.isDirectory()) throw new Error("Source pet path must be a directory");
  const manifestPath = joinSafe(root, "pet.json");
  await assertRegularFile(manifestPath, "pet.json", MAX_MANIFEST_BYTES);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`pet.json is invalid JSON: ${error instanceof Error ? error.message : error}`, {
      cause: error,
    });
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest))
    throw new Error("pet.json must be an object");
  if (manifest.id !== expectedId)
    throw new Error(`pet.json id "${String(manifest.id)}" does not match "${expectedId}"`);
  const sheet =
    typeof manifest.spritesheetPath === "string" ? manifest.spritesheetPath : "spritesheet.webp";
  if (!isSafeAssetPath(sheet) || !sheet.toLowerCase().endsWith(".webp"))
    throw new Error("pet.json spritesheetPath must be a safe WebP path");
  const atlas = await readImageMetadata(joinSafe(root, sheet));
  if (atlas.format !== "webp" || atlas.width !== 1536 || atlas.height !== 1872)
    throw new Error("spritesheet.webp must be a 1536 x 1872 WebP atlas");
  const preview = await readImageMetadata(joinSafe(root, "preview.gif"));
  if (preview.format !== "gif") throw new Error("preview.gif must be a GIF image");
  return {
    id: expectedId,
    displayName:
      typeof manifest.displayName === "string" && manifest.displayName.trim()
        ? manifest.displayName.trim()
        : expectedId,
    atlas,
    preview,
    frameWidth: 192,
    frameHeight: 208,
    columns: 8,
    rows: 9,
  };
}

function joinSafe(root, asset) {
  if (!isSafeAssetPath(asset)) throw new Error(`Unsafe asset path: ${asset}`);
  return assertInsideRoot(root, resolve(root, ...asset.split("/")));
}

function requireString(record, key) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} must be a string`);
  return value.trim();
}

export async function validateDerivedPetDirectory(directory) {
  const root = resolve(directory);
  const rootStats = await lstat(root);
  if (rootStats.isSymbolicLink())
    throw new Error("Derived pet directory must not be a symbolic link");
  if (!rootStats.isDirectory()) throw new Error("Derived pet path must be a directory");
  const manifestPath = joinSafe(root, "manifest.json");
  await assertRegularFile(manifestPath, "manifest.json", MAX_MANIFEST_BYTES);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(
      `manifest.json is invalid JSON: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest))
    throw new Error("manifest.json must be an object");
  const id = requireString(manifest, "id");
  const name = requireString(manifest, "name");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("manifest id is not canonical");
  if (!id.endsWith("-local-12state")) throw new Error("manifest id must end in -local-12state");
  if (!manifest.metadata || typeof manifest.metadata !== "object")
    throw new Error("manifest metadata is required");
  for (const [key, expected] of [
    ["locallyDerived", true],
    ["redistributionAllowed", false],
    ["localPersonalUseOnly", true],
  ]) {
    if (manifest.metadata[key] !== expected)
      throw new Error(`metadata.${key} must be ${String(expected)}`);
  }
  if (
    !manifest.assets ||
    !Array.isArray(manifest.assets.sprites) ||
    !manifest.assets.sprites.length
  )
    throw new Error("assets.sprites must be a non-empty array");
  const declared = new Set();
  for (const sprite of manifest.assets.sprites) {
    if (!isSafeAssetPath(sprite)) throw new Error(`Unsafe declared sprite path: ${String(sprite)}`);
    if (declared.has(sprite)) throw new Error(`Duplicate sprite path: ${sprite}`);
    declared.add(sprite);
    await assertRegularFile(joinSafe(root, sprite), sprite);
    await readImageMetadata(joinSafe(root, sprite));
  }
  const preview = requireString(manifest, "preview");
  if (!isSafeAssetPath(preview)) throw new Error("preview must be a safe relative path");
  await readImageMetadata(joinSafe(root, preview));
  if (!manifest.animations || typeof manifest.animations !== "object")
    throw new Error("animations must be an object");
  const keys = Object.keys(manifest.animations);
  for (const state of REQUIRED_STATES)
    if (!keys.includes(state)) throw new Error(`animations.${state} is required`);
  for (const key of keys)
    if (!REQUIRED_STATES.includes(key)) throw new Error(`animations.${key} is unsupported`);
  const animations = {};
  for (const state of REQUIRED_STATES) {
    const animation = manifest.animations[state];
    if (!animation || typeof animation !== "object")
      throw new Error(`animations.${state} is invalid`);
    const sprite = requireString(animation, "sprite");
    if (!declared.has(sprite)) throw new Error(`animations.${state}.sprite is not declared`);
    const frames = animation.frames;
    const fps = animation.fps;
    if (animation.frameWidth !== 192 || animation.frameHeight !== 208)
      throw new Error(`animations.${state} must use 192 x 208 frames`);
    if (animation.frameRow !== 0) throw new Error(`animations.${state}.frameRow must be 0`);
    if (!Number.isInteger(frames) || frames < 2 || frames > 12)
      throw new Error(`animations.${state}.frames is outside 2..12`);
    if (typeof fps !== "number" || !Number.isFinite(fps) || fps < 1 || fps > 30)
      throw new Error(`animations.${state}.fps is outside 1..30`);
    if (animation.loop !== true) throw new Error(`animations.${state}.loop must be true`);
    const image = await readImageMetadata(joinSafe(root, sprite));
    if (image.format !== "webp") throw new Error(`${sprite} must be WebP`);
    if (image.height !== 208 || image.width !== frames * 192)
      throw new Error(
        `${sprite} geometry ${image.width} x ${image.height} does not match ${frames} frames`,
      );
    animations[state] = { sprite, frames, fps };
  }
  return { id, name, stateCount: 12, animations };
}
