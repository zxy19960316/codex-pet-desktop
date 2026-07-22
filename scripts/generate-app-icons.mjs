import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import pngToIco from "png-to-ico";
import { PNG } from "pngjs";

const root = process.cwd();
const sourcePath = join(root, "assets", "branding", "cloud-terminal-pet-source.png");
const outputDirectory = join(root, "build", "generated");
const sizes = [16, 24, 32, 48, 64, 128, 256];

function squareCrop(source) {
  let left = source.width;
  let top = source.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (source.data[(y * source.width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("Branding icon has no visible pixels");
  const contentSize = Math.max(right - left + 1, bottom - top + 1);
  const side = Math.min(
    Math.min(source.width, source.height),
    contentSize + Math.ceil(contentSize * 0.16),
  );
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const originX = Math.max(0, Math.min(source.width - side, Math.round(centerX - side / 2)));
  const originY = Math.max(0, Math.min(source.height - side, Math.round(centerY - side / 2)));
  const cropped = new PNG({ width: side, height: side });
  for (let y = 0; y < side; y += 1) {
    const sourceStart = ((originY + y) * source.width + originX) * 4;
    source.data.copy(cropped.data, y * side * 4, sourceStart, sourceStart + side * 4);
  }
  return cropped;
}

function resizeBilinear(source, size) {
  const target = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    const sourceY = ((y + 0.5) * source.height) / size - 0.5;
    const y0 = Math.max(0, Math.min(source.height - 1, Math.floor(sourceY)));
    const y1 = Math.max(0, Math.min(source.height - 1, y0 + 1));
    const yWeight = Math.max(0, Math.min(1, sourceY - Math.floor(sourceY)));
    for (let x = 0; x < size; x += 1) {
      const sourceX = ((x + 0.5) * source.width) / size - 0.5;
      const x0 = Math.max(0, Math.min(source.width - 1, Math.floor(sourceX)));
      const x1 = Math.max(0, Math.min(source.width - 1, x0 + 1));
      const xWeight = Math.max(0, Math.min(1, sourceX - Math.floor(sourceX)));
      const targetOffset = (y * size + x) * 4;
      const samples = [
        { x: x0, y: y0, weight: (1 - xWeight) * (1 - yWeight) },
        { x: x1, y: y0, weight: xWeight * (1 - yWeight) },
        { x: x0, y: y1, weight: (1 - xWeight) * yWeight },
        { x: x1, y: y1, weight: xWeight * yWeight },
      ];
      let alpha = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      for (const sample of samples) {
        const offset = (sample.y * source.width + sample.x) * 4;
        const weightedAlpha = source.data[offset + 3] * sample.weight;
        alpha += weightedAlpha;
        red += source.data[offset] * weightedAlpha;
        green += source.data[offset + 1] * weightedAlpha;
        blue += source.data[offset + 2] * weightedAlpha;
      }
      target.data[targetOffset] = alpha > 0 ? Math.round(red / alpha) : 0;
      target.data[targetOffset + 1] = alpha > 0 ? Math.round(green / alpha) : 0;
      target.data[targetOffset + 2] = alpha > 0 ? Math.round(blue / alpha) : 0;
      target.data[targetOffset + 3] = Math.round(alpha);
    }
  }
  return target;
}

const source = PNG.sync.read(await readFile(sourcePath));
if (source.width !== source.height || source.width < 512)
  throw new Error(
    `Expected a square branding master of at least 512px, received ${source.width}x${source.height}`,
  );
const cropped = squareCrop(source);

await mkdir(outputDirectory, { recursive: true });
const sourceFiles = [];
for (const size of sizes) {
  const path = join(outputDirectory, `icon-${size}.png`);
  await writeFile(path, PNG.sync.write(resizeBilinear(cropped, size)));
  sourceFiles.push(path);
  if (size === 256) await writeFile(join(outputDirectory, "icon.png"), await readFile(path));
  if (size === 32) await writeFile(join(outputDirectory, "tray-icon.png"), await readFile(path));
}
await writeFile(join(outputDirectory, "icon.ico"), await pngToIco(sourceFiles));

process.stdout.write(
  `${JSON.stringify({ source: sourcePath, outputDirectory, sizes, projectOwnedBranding: true })}\n`,
);
