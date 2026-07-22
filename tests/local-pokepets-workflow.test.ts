import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
