import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import pngToIco from "png-to-ico";
import { PNG } from "pngjs";

const root = process.cwd();
const sourcePath = join(root, "pets", "example-original-pet", "preview.png");
const outputDirectory = join(root, "build", "generated");
const sizes = [16, 24, 32, 48, 64, 128, 256];

function resizeNearest(source, size) {
  const target = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor((y * source.height) / size));
    for (let x = 0; x < size; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x * source.width) / size));
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset = (y * size + x) * 4;
      source.data.copy(target.data, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return target;
}

const source = PNG.sync.read(await readFile(sourcePath));
if (source.width !== 128 || source.height !== 128)
  throw new Error(
    `Expected the original preview to be 128x128, received ${source.width}x${source.height}`,
  );

await mkdir(outputDirectory, { recursive: true });
const sourceFiles = [];
for (const size of sizes) {
  const path = join(outputDirectory, `icon-${size}.png`);
  await writeFile(path, PNG.sync.write(resizeNearest(source, size)));
  sourceFiles.push(path);
  if (size === 256) await writeFile(join(outputDirectory, "icon.png"), await readFile(path));
}
await writeFile(join(outputDirectory, "icon.ico"), await pngToIco(sourceFiles));

process.stdout.write(
  `${JSON.stringify({ source: sourcePath, outputDirectory, sizes, originalAssetOnly: true })}\n`,
);
