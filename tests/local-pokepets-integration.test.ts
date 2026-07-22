import { access, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolvePetAnimation } from "../src/core/pet/animation-resolver";
import { computePetVisualMetrics } from "../src/core/pet/pet-display";
import { PetRegistry } from "../src/core/pet/pet-registry";
import { PET_STATES } from "../src/core/pet/pet-state";
import { spriteStyle } from "../src/renderer/pet/pet-animation";
import { PetSelector } from "../src/renderer/settings/PetSelector";

const managed = process.env.LOCAL_POKEPETS_MANAGED
  ? resolve(process.env.LOCAL_POKEPETS_MANAGED)
  : undefined;
const stateFile = process.env.LOCAL_POKEPETS_STATE_FILE
  ? resolve(process.env.LOCAL_POKEPETS_STATE_FILE)
  : undefined;
const expected = ["pikachu-local-12state", "charizard-local-12state", "mew-local-12state"];

async function registry(): Promise<PetRegistry> {
  if (!managed || !stateFile)
    throw new Error("LOCAL_POKEPETS_MANAGED and LOCAL_POKEPETS_STATE_FILE are required");
  await Promise.all(expected.map((id) => access(join(managed, id, "manifest.json"))));
  await mkdir(resolve(stateFile, ".."), { recursive: true });
  return new PetRegistry({
    builtinDirectory: join(process.cwd(), "pets"),
    userDirectory: managed,
    activePetId: "pixel-sprout",
    stateFile,
  });
}

describe.runIf(Boolean(managed && stateFile))("installed local 12-state pets", () => {
  it("scans all three packages while preserving Pixel Sprout", async () => {
    const pets = await registry();
    const snapshot = await pets.scan();
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.available.map((pet) => pet.id)).toEqual(
      expect.arrayContaining(["pixel-sprout", ...expected]),
    );
    expect(pets.getPet("pixel-sprout")?.animations.idle).toBeDefined();
  });

  it("renders all three display names in the real Settings pet selector", async () => {
    const pets = await registry();
    const snapshot = await pets.scan();
    const markup = renderToStaticMarkup(
      createElement(PetSelector, {
        pets: snapshot,
        codexPokePets: { rootAvailable: false, pets: [] },
        onSelect: () => undefined,
        onImport: () => undefined,
        onImportCodexPokePet: () => undefined,
        onScanCodexPokePets: () => undefined,
        onImportDiscovered: () => undefined,
        onOpenDirectory: () => undefined,
        onRescan: () => undefined,
      }),
    );
    expect(markup).toContain("Pikachu Local 12-State");
    expect(markup).toContain("Charizard Local 12-State");
    expect(markup).toContain("Mew Local 12-State");
    for (const id of expected) expect(markup).toContain(`data-pet-id="${id}"`);
  });

  it("resolves every requested state directly and computes four safe scales", async () => {
    const pets = await registry();
    await pets.scan();
    for (const id of expected) {
      const pet = pets.getPet(id);
      expect(pet, id).toBeDefined();
      for (const state of PET_STATES) {
        const resolved = resolvePetAnimation(pet!, state);
        expect(resolved?.resolvedState, `${id}:${state}`).toBe(state);
        expect(resolved?.fallbackPath, `${id}:${state}`).toEqual([state]);
        const style = spriteStyle(resolved!.animation);
        expect(style.backgroundImage).toContain("file:///");
        expect(style["--pet-frames"]).toBe(String(resolved!.animation.frames));
      }
      for (const scale of [50, 100, 150, 200]) {
        const metrics = computePetVisualMetrics(192, 208, scale);
        expect(metrics.width, `${id}:${scale}% width`).toBeGreaterThan(0);
        expect(metrics.height, `${id}:${scale}% height`).toBeGreaterThan(0);
        expect(metrics.height, `${id}:${scale}% height`).toBeLessThanOrEqual(384);
      }
    }
  });

  it("persists each selection across fresh registry instances", async () => {
    for (const id of expected) {
      const pets = await registry();
      await pets.scan();
      await pets.setActivePet(id);
      const restored = await registry();
      await restored.scan();
      expect(restored.getActivePet()?.manifest.id).toBe(id);
    }
    const pets = await registry();
    await pets.scan();
    await pets.setActivePet("pixel-sprout");
    const restored = await registry();
    await restored.scan();
    expect(restored.getActivePet()?.manifest.id).toBe("pixel-sprout");
  });
});
