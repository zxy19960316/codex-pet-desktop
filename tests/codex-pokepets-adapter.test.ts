import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canonicalCodexPokePetId,
  CodexPokePetsAdapter,
} from "../src/core/pet/adapters/codex-pokepets-adapter";
import { CodexPokePetsProvider } from "../src/core/pet/codex-pokepets-provider";
import { PetRegistry } from "../src/core/pet/pet-registry";

let root: string;
let sources: string;
let users: string;
let builtins: string;
let registry: PetRegistry;
const example = join(process.cwd(), "pets", "example-original-pet");

function vp8x(width = 1536, height = 1872): Buffer {
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

async function sourcePet(
  id: string,
  options: { displayName?: string; sprite?: string; bytes?: Buffer } = {},
): Promise<string> {
  const directory = join(sources, id);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "pet.json"),
    `${JSON.stringify({
      id,
      displayName: options.displayName ?? `Synthetic ${id}`,
      description: "An original geometric test creature.",
      spritesheetPath: options.sprite ?? "spritesheet.webp",
    })}\n`,
    "utf8",
  );
  if (!options.sprite?.includes(".."))
    await writeFile(join(directory, "spritesheet.webp"), options.bytes ?? vp8x());
  return directory;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "codex-pokepets-adapter-"));
  sources = join(root, "source-pets");
  users = join(root, "managed-pets");
  builtins = join(root, "builtins");
  await Promise.all([mkdir(sources), mkdir(users), mkdir(builtins)]);
  await cp(example, join(builtins, "pixel-sprout"), { recursive: true });
  registry = new PetRegistry({
    builtinDirectory: builtins,
    userDirectory: users,
    activePetId: "pixel-sprout",
  });
  await registry.scan();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("CodexPokePetsAdapter", () => {
  it("recognizes a compatible local package and generates canonical source metadata", async () => {
    const directory = await sourcePet("geo-bot", { displayName: "Geo Bot" });
    const adapter = new CodexPokePetsAdapter(registry);

    const source = await adapter.inspect(directory);
    expect(source).toMatchObject({ sourcePetId: "geo-bot", displayName: "Geo Bot" });
    expect(source.spritesheetPath).toBe(join(directory, "spritesheet.webp"));
    expect(await adapter.canAdapt(directory)).toBe(true);
    expect(canonicalCodexPokePetId("geo-bot")).toBe("codex-pokepets-geo-bot");
  });

  it.each([
    ["missing pet.json", async () => mkdir(join(sources, "missing-json"))],
    ["spritesheet traversal", async () => sourcePet("traversal", { sprite: "../outside.webp" })],
    ["missing spritesheet", async () => sourcePet("missing-sheet", { bytes: vp8x() })],
    ["fake WebP", async () => sourcePet("fake-webp", { bytes: Buffer.from("not-webp") })],
    ["incompatible dimensions", async () => sourcePet("wrong-size", { bytes: vp8x(768, 1872) })],
  ])("rejects %s", async (label, prepare) => {
    const adapter = new CodexPokePetsAdapter(registry);
    const prepared = await prepare();
    const directory = typeof prepared === "string" ? prepared : join(sources, "missing-json");
    if (label === "missing spritesheet") await rm(join(directory, "spritesheet.webp"));
    await expect(adapter.inspect(directory)).rejects.toThrow();
    expect(await adapter.canAdapt(directory)).toBe(false);
  });

  it("imports atomically, records non-MIT rights metadata, selects, and rejects duplicates", async () => {
    const directory = await sourcePet("geo-bot", { displayName: "Geo Bot" });
    const adapter = new CodexPokePetsAdapter(registry);
    const source = await adapter.inspect(directory);

    const imported = await adapter.import(source);
    expect(imported.manifest.id).toBe("codex-pokepets-geo-bot");
    expect(imported.manifest.license).not.toBe("MIT");
    expect(imported.manifest.metadata).toMatchObject({
      sourceProject: "dnnyngyen/codex-pokepets",
      sourcePetId: "geo-bot",
      redistributionAllowed: false,
      locallyImported: true,
    });
    expect(imported.animations).toMatchObject({
      idle: { frameRow: 0, frames: 6 },
      error: { frameRow: 5, frames: 8 },
      waiting_input: { frameRow: 6, frames: 6 },
      working: { frameRow: 7, frames: 6 },
      thinking: { frameRow: 8, frames: 6 },
    });
    expect(registry.getActivePet()?.manifest.id).toBe("codex-pokepets-geo-bot");
    expect(
      JSON.parse(await readFile(join(users, "codex-pokepets-geo-bot", "manifest.json"), "utf8")),
    ).toMatchObject({ license: expect.not.stringMatching(/^MIT$/i) });
    await expect(adapter.import(source)).rejects.toThrow("already installed");
    expect((await readdir(users)).filter((name) => name.startsWith(".adapt-"))).toEqual([]);
  });
});

describe("CodexPokePetsProvider", () => {
  it("discovers multiple local packages without returning the source root or full user paths", async () => {
    await Promise.all([sourcePet("alpha-bot"), sourcePet("beta-bot")]);
    const adapter = new CodexPokePetsAdapter(registry);
    const provider = new CodexPokePetsProvider({ sourceDirectory: sources, registry, adapter });

    const snapshot = await provider.scan();
    expect(snapshot.rootAvailable).toBe(true);
    expect(snapshot.pets.map((pet) => pet.sourcePetId)).toEqual(["alpha-bot", "beta-bot"]);
    expect(snapshot.pets.every((pet) => pet.compatible && !pet.imported)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain(root);

    const imported = await provider.import("alpha-bot");
    expect(imported.manifest.id).toBe("codex-pokepets-alpha-bot");
    expect(
      provider.getSnapshot().pets.find((pet) => pet.sourcePetId === "alpha-bot")?.imported,
    ).toBe(true);
  });

  it("reports incompatible entries with sanitized errors and rejects arbitrary source IDs", async () => {
    await sourcePet("fake", { bytes: Buffer.from("fake") });
    const adapter = new CodexPokePetsAdapter(registry);
    const provider = new CodexPokePetsProvider({ sourceDirectory: sources, registry, adapter });

    const snapshot = await provider.scan();
    expect(snapshot.pets[0]).toMatchObject({ sourcePetId: "fake", compatible: false });
    expect(snapshot.pets[0].error).not.toContain(root);
    await expect(provider.import("../fake")).rejects.toThrow("Invalid source pet id");
  });
});
