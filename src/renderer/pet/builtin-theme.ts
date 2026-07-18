import previewUrl from "../../../pets/example-original-pet/preview.png?url";
import errorUrl from "../../../pets/example-original-pet/sprites/error.png?url";
import idleUrl from "../../../pets/example-original-pet/sprites/idle.png?url";
import successUrl from "../../../pets/example-original-pet/sprites/success.png?url";
import thinkingUrl from "../../../pets/example-original-pet/sprites/thinking.png?url";
import workingUrl from "../../../pets/example-original-pet/sprites/working.png?url";
import type { PetAnimationAsset, PetPackage } from "../../core/pet/pet-manifest";

function animation(
  name: string,
  sprite: string,
  spriteUrl: string,
  fps: number,
  loop: boolean,
): PetAnimationAsset {
  return {
    name,
    sprite,
    spriteUrl,
    frameWidth: 64,
    frameHeight: 64,
    fps,
    loop,
    sheetWidth: 256,
    sheetHeight: 64,
    frames: 4,
  };
}

export const BUILTIN_PIXEL_PET: PetPackage = {
  manifest: {
    id: "pixel-sprout",
    name: "Pixel Sprout",
    version: "1.0.0",
    author: "Codex Pet Desktop contributors",
    license: "MIT",
    preview: "preview.png",
    assets: {
      sprites: [
        "sprites/idle.png",
        "sprites/thinking.png",
        "sprites/working.png",
        "sprites/success.png",
        "sprites/error.png",
      ],
    },
    animations: {
      idle: {
        name: "idle",
        sprite: "sprites/idle.png",
        frameWidth: 64,
        frameHeight: 64,
        fps: 4,
        loop: true,
      },
      thinking: {
        name: "thinking",
        sprite: "sprites/thinking.png",
        frameWidth: 64,
        frameHeight: 64,
        fps: 6,
        loop: true,
      },
      working: {
        name: "working",
        sprite: "sprites/working.png",
        frameWidth: 64,
        frameHeight: 64,
        fps: 8,
        loop: true,
      },
      success: {
        name: "success",
        sprite: "sprites/success.png",
        frameWidth: 64,
        frameHeight: 64,
        fps: 5,
        loop: false,
      },
      error: {
        name: "error",
        sprite: "sprites/error.png",
        frameWidth: 64,
        frameHeight: 64,
        fps: 7,
        loop: true,
      },
    },
    fallbacks: {
      typing: "working",
      approval: "thinking",
      waiting_input: "thinking",
      sleep: "idle",
      quota_low: "idle",
      quota_empty: "sleep",
      offline: "sleep",
    },
    capabilities: { spriteSheet: true, sounds: false },
    metadata: { description: "Original procedural pixel pet", pixelArt: true },
  },
  origin: "builtin",
  previewUrl,
  animations: {
    idle: animation("idle", "sprites/idle.png", idleUrl, 4, true),
    thinking: animation("thinking", "sprites/thinking.png", thinkingUrl, 6, true),
    working: animation("working", "sprites/working.png", workingUrl, 8, true),
    success: animation("success", "sprites/success.png", successUrl, 5, false),
    error: animation("error", "sprites/error.png", errorUrl, 7, true),
  },
};
