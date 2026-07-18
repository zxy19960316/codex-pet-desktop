import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readPetImageMetadata } from "../src/core/pet/image-metadata";

const temporaryDirectories: string[] = [];

function riffWebP(chunk: string, payload: Buffer): Buffer {
  const padding = payload.length % 2;
  const result = Buffer.alloc(12 + 8 + payload.length + padding);
  result.write("RIFF", 0, "ascii");
  result.writeUInt32LE(result.length - 8, 4);
  result.write("WEBP", 8, "ascii");
  result.write(chunk, 12, "ascii");
  result.writeUInt32LE(payload.length, 16);
  payload.copy(result, 20);
  return result;
}

function uint24(value: number): Buffer {
  const result = Buffer.alloc(3);
  result.writeUIntLE(value, 0, 3);
  return result;
}

function vp8x(width: number, height: number): Buffer {
  return riffWebP("VP8X", Buffer.concat([Buffer.alloc(4), uint24(width - 1), uint24(height - 1)]));
}

function vp8l(width: number, height: number): Buffer {
  const packed = (BigInt(width - 1) & 0x3fffn) | ((BigInt(height - 1) & 0x3fffn) << 14n);
  const payload = Buffer.alloc(5);
  payload[0] = 0x2f;
  payload.writeUInt32LE(Number(packed), 1);
  return riffWebP("VP8L", payload);
}

function vp8(width: number, height: number): Buffer {
  const payload = Buffer.alloc(10);
  payload.set([0x9d, 0x01, 0x2a], 3);
  payload.writeUInt16LE(width, 6);
  payload.writeUInt16LE(height, 8);
  return riffWebP("VP8 ", payload);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("pet image metadata", () => {
  it.each([
    ["VP8X", vp8x(1536, 1872)],
    ["VP8L", vp8l(768, 208)],
    ["VP8", vp8(384, 208)],
  ])("reads real %s WebP signatures and dimensions", async (_kind, bytes) => {
    const directory = await mkdtemp(join(tmpdir(), "codex-pet-webp-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "sprite.webp");
    await writeFile(path, bytes);

    await expect(readPetImageMetadata(path, "sprite.webp")).resolves.toEqual({
      format: "webp",
      width: _kind === "VP8X" ? 1536 : _kind === "VP8L" ? 768 : 384,
      height: _kind === "VP8X" ? 1872 : 208,
    });
  });

  it("rejects an extension-only fake WebP", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-pet-webp-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "sprite.webp");
    await writeFile(path, Buffer.from("not a webp"));

    await expect(readPetImageMetadata(path, "sprite.webp")).rejects.toThrow(
      "not a valid PNG or WebP",
    );
  });
});
