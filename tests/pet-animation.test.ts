import { describe, expect, it } from "vitest";
import type { PetPackage } from "../src/core/pet/pet-manifest";
import { resolvePetAnimation, spriteStyle } from "../src/renderer/pet/pet-animation";

const theme: PetPackage = {
  manifest: {
    id: "test",
    name: "Test",
    version: "1.0.0",
    author: "Test",
    license: "MIT",
    preview: "preview.png",
    assets: { sprites: ["idle.png", "waiting.png"] },
    animations: {
      idle: {
        name: "idle",
        sprite: "idle.png",
        frameWidth: 64,
        frameHeight: 64,
        fps: 4,
        loop: true,
      },
      waiting_input: {
        name: "waiting",
        sprite: "waiting.png",
        frameWidth: 64,
        frameHeight: 64,
        fps: 8,
        loop: true,
      },
    },
    fallbacks: { approval: "waiting_input" },
    capabilities: { spriteSheet: true },
    metadata: {},
  },
  origin: "builtin",
  previewUrl: "preview.png",
  animations: {
    idle: {
      name: "idle",
      sprite: "idle.png",
      spriteUrl: "idle.png",
      frameWidth: 64,
      frameHeight: 64,
      fps: 4,
      loop: true,
      frames: 4,
      sheetWidth: 256,
      sheetHeight: 64,
    },
    waiting_input: {
      name: "waiting",
      sprite: "waiting.png",
      spriteUrl: "waiting.png",
      frameWidth: 64,
      frameHeight: 64,
      fps: 8,
      loop: true,
      frames: 4,
      sheetWidth: 256,
      sheetHeight: 64,
    },
  },
};

describe("pixel pet animation", () => {
  it("resolves a declared fallback and computes integer sprite geometry", () => {
    const resolved = resolvePetAnimation(theme, "approval");
    expect(resolved?.resolvedState).toBe("waiting_input");
    expect(spriteStyle(resolved!.animation)).toMatchObject({
      width: "64px",
      height: "64px",
      backgroundSize: "256px 64px",
      "--pet-frame-distance": "-256px",
      "--pet-duration": "500ms",
    });
  });

  it("breaks fallback cycles by using idle", () => {
    const cyclic: PetPackage = {
      ...theme,
      manifest: {
        ...theme.manifest,
        fallbacks: { approval: "waiting_input", waiting_input: "approval" },
      },
      animations: { idle: theme.animations.idle },
    };
    expect(resolvePetAnimation(cyclic, "approval")?.resolvedState).toBe("idle");
  });
});
