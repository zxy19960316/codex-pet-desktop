import spriteSheetUrl from "../../../themes/example-original-pet/assets/pixel-sprout.svg?url";
import type { RuntimePetTheme } from "../../shared/pet-manifest";

export const BUILTIN_PIXEL_THEME: RuntimePetTheme = {
  id: "pixel-sprout",
  displayName: "Pixel Sprout",
  imageUrl: spriteSheetUrl,
  sheetWidth: 256,
  sheetHeight: 256,
  animations: {
    idle: { row: 0, frames: 4, frameWidth: 64, frameHeight: 64, durationMs: 900, loop: true },
    thinking: { row: 1, frames: 4, frameWidth: 64, frameHeight: 64, durationMs: 700, loop: true },
    working: { row: 2, frames: 4, frameWidth: 64, frameHeight: 64, durationMs: 520, loop: true },
    success: { row: 3, frames: 4, frameWidth: 64, frameHeight: 64, durationMs: 800, loop: false },
  },
  fallbacks: {
    typing: "working",
    approval: "thinking",
    waiting_input: "thinking",
    error: "thinking",
    sleeping: "idle",
    quota_low: "idle",
    quota_exhausted: "sleeping",
  },
  attribution: [{ name: "Codex Pet Desktop contributors", license: "MIT" }],
};
