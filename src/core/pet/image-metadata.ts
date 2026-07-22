import { lstat, readFile } from "node:fs/promises";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export type PetImageFormat = "png" | "webp";

export interface PetImageMetadata {
  format: PetImageFormat;
  width: number;
  height: number;
}

async function assertImageFile(path: string, label: string, maxBytes: number): Promise<number> {
  let stats;
  try {
    stats = await lstat(path);
  } catch {
    throw new Error(`${label} is missing`);
  }
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (!stats.isFile()) throw new Error(`${label} must be a regular file`);
  if (stats.size > maxBytes) throw new Error(`${label} exceeds the 20 MB asset limit`);
  return stats.size;
}

function positiveDimensions(width: number, height: number, label: string): PetImageMetadata {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0)
    throw new Error(`${label} has invalid image dimensions`);
  return { format: "webp", width, height };
}

function readPng(buffer: Buffer, label: string): PetImageMetadata | undefined {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return undefined;
  if (buffer.toString("ascii", 12, 16) !== "IHDR")
    throw new Error(`${label} has an invalid PNG header`);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!width || !height) throw new Error(`${label} has invalid PNG dimensions`);
  return { format: "png", width, height };
}

function readWebP(buffer: Buffer, label: string): PetImageMetadata | undefined {
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
    const chunkLength = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    const end = data + chunkLength;
    if (end > declaredLength) throw new Error(`${label} has a truncated WebP chunk`);

    if (kind === "VP8X") {
      if (chunkLength < 10) throw new Error(`${label} has an invalid VP8X header`);
      return positiveDimensions(
        buffer.readUIntLE(data + 4, 3) + 1,
        buffer.readUIntLE(data + 7, 3) + 1,
        label,
      );
    }
    if (kind === "VP8L") {
      if (chunkLength < 5 || buffer[data] !== 0x2f)
        throw new Error(`${label} has an invalid VP8L header`);
      const packed = buffer.readUInt32LE(data + 1);
      return positiveDimensions((packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1, label);
    }
    if (kind === "VP8 ") {
      if (
        chunkLength < 10 ||
        buffer[data + 3] !== 0x9d ||
        buffer[data + 4] !== 0x01 ||
        buffer[data + 5] !== 0x2a
      )
        throw new Error(`${label} has an invalid VP8 header`);
      return positiveDimensions(
        buffer.readUInt16LE(data + 6) & 0x3fff,
        buffer.readUInt16LE(data + 8) & 0x3fff,
        label,
      );
    }
    offset = end + (chunkLength % 2);
  }
  throw new Error(`${label} has no supported WebP image chunk`);
}

export async function readPetImageMetadata(
  path: string,
  label: string,
  maxBytes = DEFAULT_MAX_IMAGE_BYTES,
): Promise<PetImageMetadata> {
  await assertImageFile(path, label, maxBytes);
  const buffer = await readFile(path);
  const metadata = readPng(buffer, label) ?? readWebP(buffer, label);
  if (!metadata) throw new Error(`${label} is not a valid PNG or WebP file`);
  return metadata;
}
