import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PNG } from "pngjs";
import { afterEach, describe, expect, it } from "vitest";
import {
  ALLOWED_PETS,
  REQUIRED_STATES,
  assertAllowedPet,
  assertInsideRoot,
  readImageMetadata,
  validateDerivedPetDirectory,
  validateSourcePetDirectory,
} from "../scripts/local-pokepets/local-pokepets-lib.mjs";

const temporaryDirectories: string[] = [];
const execFileAsync = promisify(execFile);
const imageTools = join(process.cwd(), "scripts", "local-pokepets", "image-tools.py");
const buildAnimationStrip = join(
  process.cwd(),
  "scripts",
  "local-pokepets",
  "build-animation-strip.mjs",
);

function vp8x(width: number, height: number): Buffer {
  const result = Buffer.alloc(30);
  result.write("RIFF", 0, "ascii");
  result.writeUInt32LE(22, 4);
  result.write("WEBP", 8, "ascii");
  result.write("VP8X", 12, "ascii");
  result.writeUInt32LE(10, 16);
  result.writeUIntLE(width - 1, 24, 3);
  result.writeUIntLE(height - 1, 27, 3);
  return result;
}

function gif(width: number, height: number): Buffer {
  const result = Buffer.alloc(10);
  result.write("GIF89a", 0, "ascii");
  result.writeUInt16LE(width, 6);
  result.writeUInt16LE(height, 8);
  return result;
}

function transparentKeyframeGrid(columns = 4, rows = 2): Buffer {
  const width = columns * 16;
  const height = rows * 16;
  const image = new PNG({ width, height });
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      for (let y = row * cellHeight + 4; y < (row + 1) * cellHeight - 3; y += 1) {
        for (let x = column * cellWidth + 4; x < (column + 1) * cellWidth - 3; x += 1) {
          const offset = (y * width + x) * 4;
          image.data[offset] = 60 + column * 35;
          image.data[offset + 1] = 80 + row * 80;
          image.data[offset + 2] = 180;
          image.data[offset + 3] = 255;
        }
      }
    }
  }
  return PNG.sync.write(image);
}

function transparentSingleSubject(): Buffer {
  const image = new PNG({ width: 64, height: 64 });
  for (let y = 14; y < 50; y += 1) {
    for (let x = 18; x < 46; x += 1) {
      const offset = (y * image.width + x) * 4;
      image.data[offset] = 245;
      image.data[offset + 1] = 132;
      image.data[offset + 2] = 48;
      image.data[offset + 3] = 255;
    }
  }
  return PNG.sync.write(image);
}

function transparentAnimationStrip(frames = 6): Buffer {
  const width = frames * 192;
  const image = new PNG({ width, height: 208 });
  for (let frame = 0; frame < frames; frame += 1) {
    const centerX = frame * 192 + 96 + (frame % 3) - 1;
    const centerY = 110 + (frame % 2);
    for (let y = centerY - 18; y < centerY + 18; y += 1) {
      for (let x = centerX - 14; x < centerX + 14; x += 1) {
        const offset = (y * width + x) * 4;
        image.data[offset] = 80 + frame * 20;
        image.data[offset + 1] = 120;
        image.data[offset + 2] = 210 - frame * 15;
        image.data[offset + 3] = 255;
      }
    }
  }
  return PNG.sync.write(image);
}

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("local PokéPets workflow boundaries", () => {
  it("allow-lists exactly the three requested source pets", () => {
    expect(ALLOWED_PETS).toEqual(["pikachu", "charizard", "mew"]);
    expect(assertAllowedPet("pikachu")).toBe("pikachu");
    expect(() => assertAllowedPet("../pikachu")).toThrow("not allow-listed");
    expect(() => assertAllowedPet("bulbasaur")).toThrow("not allow-listed");
  });

  it("rejects output paths outside the ignored workspace root", async () => {
    const root = await temporaryDirectory("local-pokepets-root-");
    expect(assertInsideRoot(root, join(root, "derived", "pikachu"))).toContain(root);
    expect(() => assertInsideRoot(root, join(root, "..", "escape"))).toThrow(
      "outside the local workspace",
    );
  });
});

describe("local PokéPets image and package validation", () => {
  it("reads WebP and GIF dimensions from real signatures", async () => {
    const root = await temporaryDirectory("local-pokepets-images-");
    const webpPath = join(root, "atlas.webp");
    const gifPath = join(root, "preview.gif");
    await Promise.all([writeFile(webpPath, vp8x(1536, 1872)), writeFile(gifPath, gif(96, 104))]);
    await expect(readImageMetadata(webpPath)).resolves.toEqual({
      format: "webp",
      width: 1536,
      height: 1872,
    });
    await expect(readImageMetadata(gifPath)).resolves.toEqual({
      format: "gif",
      width: 96,
      height: 104,
    });
  });

  it("turns one row of a transparent action grid into a validated animation strip", async () => {
    const root = await temporaryDirectory("local-pokepets-grid-");
    const input = join(root, "keyframes.png");
    const output = join(root, "success.webp");
    await writeFile(input, transparentKeyframeGrid());

    await execFileAsync("python", [
      imageTools,
      "grid-alpha-stats",
      "--input",
      input,
      "--columns",
      "4",
      "--rows",
      "2",
    ]);
    await execFileAsync("python", [
      imageTools,
      "strip",
      "--input",
      input,
      "--out",
      output,
      "--state",
      "success",
      "--frames",
      "8",
      "--grid-columns",
      "4",
      "--grid-rows",
      "2",
      "--grid-row",
      "0",
    ]);

    await expect(readImageMetadata(output)).resolves.toEqual({
      format: "webp",
      width: 1536,
      height: 208,
    });
  }, 20_000);

  it("turns a complete 2 by 2 single-state grid into a validated animation strip", async () => {
    const root = await temporaryDirectory("local-pokepets-square-grid-");
    const input = join(root, "keyframes.png");
    const output = join(root, "working.webp");
    await writeFile(input, transparentKeyframeGrid(2, 2));

    await execFileAsync("python", [
      imageTools,
      "strip",
      "--input",
      input,
      "--out",
      output,
      "--state",
      "working",
      "--frames",
      "8",
      "--grid-columns",
      "2",
      "--grid-rows",
      "2",
    ]);

    await expect(readImageMetadata(output)).resolves.toEqual({
      format: "webp",
      width: 1536,
      height: 208,
    });
  }, 20_000);

  it("records a 2 by 2 generated sheet as one independent state", async () => {
    const root = await temporaryDirectory("local-pokepets-square-build-");
    const input = join(root, "keyframes.png");
    const sourceAtlas = join(root, "source.webp");
    await Promise.all([
      writeFile(input, transparentKeyframeGrid(2, 2)),
      writeFile(sourceAtlas, vp8x(1536, 1872)),
    ]);

    await execFileAsync("node", [
      buildAnimationStrip,
      "--workspace",
      root,
      "--pet",
      "pikachu",
      "--state",
      "working",
      "--source-atlas",
      sourceAtlas,
      "--input",
      input,
      "--classification",
      "independent-generated",
      "--source-state",
      "image2-v2-working",
      "--grid-columns",
      "2",
      "--grid-rows",
      "2",
    ]);

    const directory = join(root, "derived", "pikachu-local-12state");
    await expect(readImageMetadata(join(directory, "working.webp"))).resolves.toEqual({
      format: "webp",
      width: 1536,
      height: 208,
    });
    const report = JSON.parse(await readFile(join(directory, "generation-report.json"), "utf8"));
    expect(report.states.working).toMatchObject({
      classification: "independent-generated",
      sourceState: "image2-v2-working",
      keyframeGrid: { columns: 2, rows: 2, fitScale: 1 },
    });
  }, 20_000);

  it("accepts full-frame 3 by 2 and 4 by 2 single-state grids", async () => {
    const root = await temporaryDirectory("local-pokepets-full-frame-build-");
    const sourceAtlas = join(root, "source.webp");
    await writeFile(sourceAtlas, vp8x(1536, 1872));

    const cases = [
      { state: "thinking", columns: 3, rows: 2, frames: 6, width: 1152 },
      { state: "working", columns: 4, rows: 2, frames: 8, width: 1536 },
    ] as const;

    for (const testCase of cases) {
      const input = join(root, `${testCase.state}-keyframes.png`);
      await writeFile(input, transparentKeyframeGrid(testCase.columns, testCase.rows));
      await execFileAsync("node", [
        buildAnimationStrip,
        "--workspace",
        root,
        "--pet",
        "mew",
        "--state",
        testCase.state,
        "--source-atlas",
        sourceAtlas,
        "--input",
        input,
        "--classification",
        "independent-generated",
        "--source-state",
        `image2-v4-${testCase.state}`,
        "--grid-columns",
        String(testCase.columns),
        "--grid-rows",
        String(testCase.rows),
      ]);

      await expect(
        readImageMetadata(join(root, "derived", "mew-local-12state", `${testCase.state}.webp`)),
      ).resolves.toEqual({
        format: "webp",
        width: testCase.width,
        height: 208,
      });
    }

    const report = JSON.parse(
      await readFile(join(root, "derived", "mew-local-12state", "generation-report.json"), "utf8"),
    );
    expect(report.states.thinking.keyframeGrid).toMatchObject({ columns: 3, rows: 2 });
    expect(report.states.working.keyframeGrid).toMatchObject({ columns: 4, rows: 2 });
  }, 20_000);

  it("keeps a single-pose motion loop pixel-identical at the seam", async () => {
    const root = await temporaryDirectory("local-pokepets-loop-seam-");
    const input = join(root, "subject.png");
    const output = join(root, "success.webp");
    await writeFile(input, transparentSingleSubject());

    await execFileAsync("python", [
      imageTools,
      "strip",
      "--input",
      input,
      "--out",
      output,
      "--state",
      "success",
      "--frames",
      "8",
    ]);
    const { stdout } = await execFileAsync("python", [
      imageTools,
      "strip-stats",
      "--input",
      output,
      "--frames",
      "8",
    ]);
    const stats = JSON.parse(stdout);

    expect(stats).toMatchObject({
      blankFrames: 0,
      edgeTouches: 0,
      loopPixelDifference: 0,
      loopCenterDelta: 0,
    });
    expect(stats.uniqueFrameCount).toBeGreaterThanOrEqual(6);
    expect(stats.maxCenterStep).toBeLessThanOrEqual(20);
  }, 20_000);

  it("extracts an existing animation strip frame by frame", async () => {
    const root = await temporaryDirectory("local-pokepets-strip-input-");
    const input = join(root, "source-strip.png");
    const output = join(root, "waiting-input.webp");
    await writeFile(input, transparentAnimationStrip());

    await execFileAsync("python", [
      imageTools,
      "strip",
      "--input",
      input,
      "--out",
      output,
      "--state",
      "waiting_input",
      "--frames",
      "6",
      "--input-is-strip",
    ]);
    const { stdout } = await execFileAsync("python", [
      imageTools,
      "strip-stats",
      "--input",
      output,
      "--frames",
      "6",
    ]);
    const stats = JSON.parse(stdout);

    expect(stats).toMatchObject({
      width: 1152,
      height: 208,
      frames: 6,
      blankFrames: 0,
      edgeTouches: 0,
      uniqueFrameCount: 6,
    });
    expect(stats.maxSubjectWidth).toBeLessThan(80);
  }, 20_000);

  it("validates source identity and the 8 by 9 atlas contract", async () => {
    const root = await temporaryDirectory("local-pokepets-source-");
    const pet = join(root, "pikachu");
    await mkdir(pet);
    await Promise.all([
      writeFile(
        join(pet, "pet.json"),
        `${JSON.stringify({
          id: "pikachu",
          displayName: "Pikachu",
          spritesheetPath: "spritesheet.webp",
        })}\n`,
      ),
      writeFile(join(pet, "spritesheet.webp"), vp8x(1536, 1872)),
      writeFile(join(pet, "preview.gif"), gif(96, 104)),
    ]);
    await expect(validateSourcePetDirectory(pet, "pikachu")).resolves.toMatchObject({
      id: "pikachu",
      columns: 8,
      rows: 9,
    });
    await expect(validateSourcePetDirectory(pet, "mew")).rejects.toThrow("does not match");
  });

  it("requires all 12 state strips and rejects symbolic-link assets", async () => {
    const root = await temporaryDirectory("local-pokepets-derived-");
    const pet = join(root, "pikachu-local-12state");
    await mkdir(pet);
    const animations = Object.fromEntries(
      REQUIRED_STATES.map((state) => [
        state,
        {
          name: state,
          sprite: `${state.replaceAll("_", "-")}.webp`,
          format: "webp",
          frameWidth: 192,
          frameHeight: 208,
          frameRow: 0,
          frames: 6,
          fps: 5,
          loop: true,
        },
      ]),
    );
    const sprites = REQUIRED_STATES.map((state) => `${state.replaceAll("_", "-")}.webp`);
    await Promise.all([
      ...sprites.map((sprite) => writeFile(join(pet, sprite), vp8x(1152, 208))),
      writeFile(join(pet, "preview.webp"), vp8x(192, 208)),
      writeFile(
        join(pet, "manifest.json"),
        `${JSON.stringify({
          id: "pikachu-local-12state",
          name: "Pikachu Local 12-State",
          version: "1.0.0-local",
          author: "Local personal derivative",
          license: "Personal local use only",
          preview: "preview.webp",
          assets: { sprites },
          animations,
          capabilities: { spriteSheet: true, sounds: false },
          metadata: {
            locallyDerived: true,
            redistributionAllowed: false,
            localPersonalUseOnly: true,
          },
        })}\n`,
      ),
    ]);

    await expect(validateDerivedPetDirectory(pet)).resolves.toMatchObject({
      id: "pikachu-local-12state",
      stateCount: 12,
    });

    const linked = join(root, "linked.webp");
    await writeFile(linked, vp8x(1152, 208));
    await rm(join(pet, "sleep.webp"));
    try {
      await symlink(linked, join(pet, "sleep.webp"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    await expect(validateDerivedPetDirectory(pet)).rejects.toThrow("symbolic link");
  });
});
