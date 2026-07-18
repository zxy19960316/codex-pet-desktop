import { deflateSync } from "node:zlib";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const output = join(process.cwd(), "pets", "example-original-pet");
const palette = {
  transparent: [0, 0, 0, 0],
  ink: [23, 35, 59, 255],
  leaf: [79, 138, 85, 255],
  cream: [243, 228, 180, 255],
  accent: [217, 109, 59, 255],
  light: [255, 248, 216, 255],
  red: [184, 62, 57, 255],
};

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return result;
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    rows[row] = 0;
    pixels.copy(rows, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function canvas(width, height) {
  return { width, height, pixels: Buffer.alloc(width * height * 4) };
}

function rectangle(target, x, y, width, height, color) {
  for (let py = Math.max(0, y); py < Math.min(target.height, y + height); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(target.width, x + width); px += 1) {
      const offset = (py * target.width + px) * 4;
      target.pixels.set(color, offset);
    }
  }
}

function drawSprout(target, offsetX, frame, state) {
  const bounce = state === "working" ? frame % 2 : frame === 1 || frame === 3 ? 1 : 0;
  const x = offsetX + 8;
  const y = 7 + bounce;
  rectangle(target, x + 20, y, 6, 10, palette.ink);
  rectangle(target, x + 11, y + 2, 12, 7, palette.ink);
  rectangle(target, x + 24, y + 2, 12, 7, palette.ink);
  rectangle(target, x + 13, y + 4, 9, 5, palette.leaf);
  rectangle(target, x + 25, y + 4, 9, 5, palette.leaf);
  rectangle(target, x + 6, y + 12, 36, 6, palette.ink);
  rectangle(target, x + 3, y + 18, 42, 23, palette.ink);
  rectangle(target, x + 7, y + 18, 34, 20, palette.cream);
  rectangle(target, x + 9, y + 22, 6, 5, palette.accent);
  rectangle(target, x + 33, y + 22, 6, 5, palette.accent);
  rectangle(target, x + 15, y + 17, 5, 7, palette.ink);
  rectangle(target, x + 28, y + 17, 5, 7, palette.ink);
  rectangle(target, x + 16, y + 18, 2, 2, palette.light);
  rectangle(target, x + 29, y + 18, 2, 2, palette.light);
  rectangle(target, x + 20, y + 29, 8, 3, palette.ink);
  rectangle(target, x + 8, y + 38, 32, 7, palette.leaf);
  rectangle(target, x + 11, y + 45, 9, 7, palette.ink);
  rectangle(target, x + 28, y + 45, 9, 7, palette.ink);
  rectangle(target, x + 13, y + 45, 7, 5, palette.leaf);
  rectangle(target, x + 28, y + 45, 7, 5, palette.leaf);

  if (state === "thinking") {
    rectangle(target, x + 42 + frame * 2, y + 8 - frame, 4, 4, palette.accent);
    rectangle(target, x + 38 + frame * 2, y + 15 - frame, 3, 3, palette.accent);
  } else if (state === "working") {
    rectangle(target, x - 2 + frame * 2, y + 29, 6, 4, palette.cream);
    rectangle(target, x + 43 - frame, y + 28, 6, 4, palette.cream);
  } else if (state === "success") {
    rectangle(target, x + 43, y + 5 + frame, 5, 5, palette.accent);
    rectangle(target, x - 2, y + 10 - frame, 4, 4, palette.accent);
  } else if (state === "error") {
    rectangle(target, x + 44, y + 5, 5, 14, palette.red);
    rectangle(target, x + 44, y + 22, 5, 5, palette.red);
  }
}

function spriteSheet(state) {
  const target = canvas(256, 64);
  for (let frame = 0; frame < 4; frame += 1) drawSprout(target, frame * 64, frame, state);
  return target;
}

function previewFromIdle(idle) {
  const target = canvas(128, 128);
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const source = (y * idle.width + x) * 4;
      const color = idle.pixels.subarray(source, source + 4);
      rectangle(target, x * 2, y * 2, 2, 2, color);
    }
  }
  return target;
}

await mkdir(join(output, "sprites"), { recursive: true });
const sheets = new Map(
  ["idle", "thinking", "working", "success", "error"].map((state) => [state, spriteSheet(state)]),
);
for (const [state, sheet] of sheets)
  await writeFile(
    join(output, "sprites", `${state}.png`),
    encodePng(sheet.width, sheet.height, sheet.pixels),
  );
const preview = previewFromIdle(sheets.get("idle"));
await writeFile(
  join(output, "preview.png"),
  encodePng(preview.width, preview.height, preview.pixels),
);
