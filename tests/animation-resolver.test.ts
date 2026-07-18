import { describe, expect, it } from "vitest";
import { AnimationResolver } from "../src/core/pet/animation-resolver";
import type { PetAnimationAsset, PetManifest, PetPackage } from "../src/core/pet/pet-manifest";
import type { PetState } from "../src/core/pet/pet-state";

function animation(name: string): PetAnimationAsset {
  return {
    name,
    sprite: `${name}.png`,
    spriteUrl: `file:///${name}.png`,
    frameWidth: 64,
    frameHeight: 64,
    fps: 8,
    loop: true,
    frames: 4,
    sheetWidth: 256,
    sheetHeight: 64,
  };
}

function pet(states: PetState[], fallbacks?: PetManifest["fallbacks"]): PetPackage {
  const animations = Object.fromEntries(states.map((state) => [state, animation(state)]));
  return {
    manifest: {
      id: "resolver-test",
      name: "Resolver Test",
      version: "1.0.0",
      author: "Tests",
      license: "MIT",
      preview: "preview.png",
      assets: { sprites: states.map((state) => `${state}.png`) },
      animations,
      fallbacks,
      capabilities: { spriteSheet: true },
      metadata: {},
    },
    origin: "builtin",
    previewUrl: "file:///preview.png",
    animations,
  };
}

describe("AnimationResolver", () => {
  const resolver = new AnimationResolver();

  it("returns a declared working animation directly", () => {
    const result = resolver.resolve(pet(["idle", "thinking", "working"]), "working");
    expect(result).toMatchObject({
      requestedState: "working",
      resolvedState: "working",
      fallbackPath: ["working"],
    });
  });

  it("falls back from missing working to thinking", () => {
    const result = resolver.resolve(pet(["idle", "thinking"]), "working");
    expect(result?.resolvedState).toBe("thinking");
    expect(result?.fallbackPath).toEqual(["working", "thinking"]);
  });

  it("falls back from missing working and thinking to idle", () => {
    const result = resolver.resolve(pet(["idle"]), "working");
    expect(result?.resolvedState).toBe("idle");
    expect(result?.fallbackPath).toEqual(["working", "thinking", "idle"]);
  });

  it("honors a manifest fallback and safely breaks cycles", () => {
    expect(
      resolver.resolve(pet(["idle", "success"], { working: "success" }), "working")?.resolvedState,
    ).toBe("success");
    const cyclic = pet(["idle"], { working: "thinking", thinking: "working" });
    expect(resolver.resolve(cyclic, "working")?.resolvedState).toBe("idle");
  });

  it("returns undefined rather than crashing for a corrupted package without idle", () => {
    expect(
      resolver.resolve(pet([], { working: "thinking", thinking: "working" }), "working"),
    ).toBeUndefined();
  });
});
