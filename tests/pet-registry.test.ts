import { cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PetRegistry } from "../src/core/pet/pet-registry";

let root: string;
let builtins: string;
let users: string;
let imports: string;
const example = join(process.cwd(), "pets", "example-original-pet");

async function packageAt(parent: string, folder: string, id: string, name = id): Promise<string> {
  const destination = join(parent, folder);
  await cp(example, destination, { recursive: true });
  const manifestPath = join(destination, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.id = id;
  manifest.name = name;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return destination;
}

function registry(activePetId = "pixel-sprout"): PetRegistry {
  return new PetRegistry({ builtinDirectory: builtins, userDirectory: users, activePetId });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "codex-pet-registry-"));
  builtins = join(root, "builtins");
  users = join(root, "users");
  imports = join(root, "imports");
  await Promise.all([mkdir(builtins), mkdir(users), mkdir(imports)]);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("PetRegistry", () => {
  it("loads a normal manifest and resolves concrete PNG geometry", async () => {
    await packageAt(builtins, "example-original-pet", "pixel-sprout", "Pixel Sprout");
    const pets = registry();
    const snapshot = await pets.scan();
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.active?.manifest.name).toBe("Pixel Sprout");
    expect(snapshot.active?.animations.working).toMatchObject({
      frames: 4,
      sheetWidth: 256,
      sheetHeight: 64,
    });
    expect(snapshot.active?.animations.working?.spriteUrl).toMatch(/^file:\/\//);
  });

  it("isolates missing resources and malformed manifests without crashing the scan", async () => {
    await packageAt(builtins, "good", "good-pet", "Good Pet");
    const missing = await packageAt(builtins, "missing", "missing-pet");
    await unlink(join(missing, "sprites", "working.png"));
    const malformed = join(builtins, "malformed");
    await mkdir(malformed);
    await writeFile(join(malformed, "manifest.json"), "{not-json", "utf8");

    const pets = registry("good-pet");
    const snapshot = await pets.scan();
    expect(snapshot.available.map((pet) => pet.id)).toEqual(["good-pet"]);
    expect(snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: "missing",
          reason: expect.stringContaining("working.png"),
        }),
        expect.objectContaining({
          packageName: "malformed",
          reason: expect.stringContaining("invalid JSON"),
        }),
      ]),
    );
  });

  it("loads a valid pet with no working animation so the resolver can apply fallback", async () => {
    const path = await packageAt(builtins, "minimal", "minimal-pet");
    const manifestPath = join(path, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      animations: Record<string, unknown>;
      assets: { sprites: string[] };
    };
    delete manifest.animations.working;
    manifest.assets.sprites = manifest.assets.sprites.filter(
      (sprite) => !sprite.endsWith("working.png"),
    );
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const pets = registry("minimal-pet");
    await pets.scan();
    expect(pets.getActivePet()?.animations.working).toBeUndefined();
    expect(pets.getActivePet()?.animations.thinking).toBeDefined();
  });

  it("switches among multiple pets, persists the choice, and falls back from an absent id", async () => {
    await packageAt(builtins, "alpha", "alpha-pet", "Alpha");
    await packageAt(builtins, "beta", "beta-pet", "Beta");
    const pets = registry("alpha-pet");
    await pets.scan();
    await pets.setActivePet("beta-pet");
    expect(pets.getActivePet()?.manifest.id).toBe("beta-pet");

    const restored = registry("alpha-pet");
    await restored.scan();
    expect(restored.getActivePet()?.manifest.id).toBe("beta-pet");
    await writeFile(join(users, ".active-pet.json"), '{"id":"absent"}\n', "utf8");
    const fallback = registry("alpha-pet");
    await fallback.scan();
    expect(fallback.getActivePet()?.manifest.id).toBe("alpha-pet");
    await expect(fallback.setActivePet("absent")).rejects.toThrow('Pet "absent" is not available');
  });

  it("imports a valid folder and rejects broken or duplicate imports without partial packages", async () => {
    await packageAt(builtins, "builtin", "pixel-sprout");
    const source = await packageAt(imports, "new-source", "new-pet", "New Pet");
    const broken = await packageAt(imports, "broken-source", "broken-pet");
    await unlink(join(broken, "preview.png"));
    const pets = registry();
    await pets.scan();

    const imported = await pets.importPetPackage(source);
    expect(imported.manifest.name).toBe("New Pet");
    expect(pets.getPet("new-pet")).toBeDefined();
    await expect(readFile(join(users, "new-pet", "manifest.json"), "utf8")).resolves.toContain(
      '"id": "new-pet"',
    );
    await expect(pets.importPetPackage(source)).rejects.toThrow(
      'Pet "new-pet" is already installed',
    );
    await expect(pets.importPetPackage(broken)).rejects.toThrow("preview.png is missing");
    await expect(readFile(join(users, "broken-pet", "manifest.json"), "utf8")).rejects.toThrow();
  });

  it("loads a validated multi-row WebP atlas without changing horizontal PNG behavior", async () => {
    const path = await packageAt(builtins, "atlas", "atlas-pet");
    const payload = Buffer.alloc(10);
    payload.writeUIntLE(1535, 4, 3);
    payload.writeUIntLE(1871, 7, 3);
    const webp = Buffer.alloc(30);
    webp.write("RIFF", 0, "ascii");
    webp.writeUInt32LE(22, 4);
    webp.write("WEBP", 8, "ascii");
    webp.write("VP8X", 12, "ascii");
    webp.writeUInt32LE(10, 16);
    payload.copy(webp, 20);
    await writeFile(join(path, "sprites", "atlas.webp"), webp);
    const manifestPath = join(path, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.preview = "sprites/atlas.webp";
    manifest.assets = { sprites: ["sprites/atlas.webp"] };
    manifest.animations = {
      idle: {
        name: "idle",
        sprite: "sprites/atlas.webp",
        format: "webp",
        frameWidth: 192,
        frameHeight: 208,
        frameRow: 8,
        frames: 6,
        fps: 6,
        loop: true,
      },
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const pets = registry("atlas-pet");
    const snapshot = await pets.scan();
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.active?.animations.idle).toMatchObject({
      frames: 6,
      frameRow: 8,
      sheetWidth: 1536,
      sheetHeight: 1872,
      format: "webp",
    });
  });
});
