import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validatePetManifest } from "../src/core/pet/pet-manifest";

async function exampleManifest(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(join(process.cwd(), "pets", "example-original-pet", "manifest.json"), "utf8"),
  ) as Record<string, unknown>;
}

describe("pet manifest schema", () => {
  it("accepts the original example package manifest", async () => {
    const result = validatePetManifest(await exampleManifest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe("pixel-sprout");
      expect(result.value.animations.idle?.fps).toBe(4);
      expect(result.value.capabilities.spriteSheet).toBe(true);
    }
  });

  it("reports required metadata and idle animation errors", async () => {
    const manifest = await exampleManifest();
    manifest.author = "";
    manifest.animations = { working: (manifest.animations as Record<string, unknown>).working };
    const result = validatePetManifest(manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "author" }),
          expect.objectContaining({ path: "animations.idle" }),
        ]),
      );
    }
  });

  it("rejects traversal, undeclared sprites, unsupported states, and invalid capability values", async () => {
    const manifest = await exampleManifest();
    manifest.preview = "../preview.png";
    (manifest.animations as Record<string, unknown>).dancing = {
      name: "dancing",
      sprite: "sprites/unknown.png",
      frameWidth: 64,
      frameHeight: 64,
      fps: 8,
      loop: true,
    };
    manifest.capabilities = { spriteSheet: false };
    const result = validatePetManifest(manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.errors.map((error) => error.path);
      expect(paths).toContain("preview");
      expect(paths).toContain("animations.dancing");
      expect(paths).toContain("capabilities.spriteSheet");
    }
  });

  it("accepts a declared WebP atlas row while preserving PNG defaults", async () => {
    const manifest = await exampleManifest();
    manifest.preview = "sprites/atlas.webp";
    manifest.assets = { sprites: ["sprites/atlas.webp"] };
    manifest.animations = {
      idle: {
        name: "idle",
        sprite: "sprites/atlas.webp",
        format: "webp",
        frameWidth: 192,
        frameHeight: 208,
        frameRow: 0,
        frames: 6,
        fps: 6,
        loop: true,
      },
    };

    const result = validatePetManifest(manifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.animations.idle).toMatchObject({
        format: "webp",
        frameRow: 0,
        frames: 6,
      });
    }
  });

  it("rejects arbitrary image extensions and mismatched declared formats", async () => {
    const manifest = await exampleManifest();
    manifest.preview = "preview.svg";
    const idle = (manifest.animations as Record<string, Record<string, unknown>>).idle;
    idle.format = "webp";

    const result = validatePetManifest(manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "preview" }),
          expect.objectContaining({ path: "animations.idle.format" }),
        ]),
      );
    }
  });
});
