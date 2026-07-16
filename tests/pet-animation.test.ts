import { describe, expect, it } from "vitest";
import type { RuntimePetTheme } from "../src/shared/pet-manifest";
import { resolvePetAnimation, spriteStyle } from "../src/renderer/pet/pet-animation";

const theme: RuntimePetTheme = {
  id: "test",
  displayName: "Test",
  imageUrl: "asset.png",
  sheetWidth: 256,
  sheetHeight: 256,
  animations: {
    idle: {
      row: 0,
      frames: 4,
      frameWidth: 64,
      frameHeight: 64,
      durationMs: 900,
      loop: true,
    },
    waiting_input: {
      row: 1,
      frames: 4,
      frameWidth: 64,
      frameHeight: 64,
      durationMs: 700,
      loop: true,
    },
  },
  fallbacks: { approval: "waiting_input" },
};

describe("pixel pet animation", () => {
  it("resolves a declared fallback and computes integer sprite geometry", () => {
    const resolved = resolvePetAnimation(theme, "approval");
    expect(resolved.state).toBe("waiting_input");
    expect(spriteStyle(theme, resolved.animation)).toMatchObject({
      width: "64px",
      height: "64px",
      backgroundSize: "256px 256px",
      backgroundPositionY: "-64px",
      "--pet-frame-distance": "-256px",
    });
  });

  it("breaks fallback cycles by using idle", () => {
    const cyclic: RuntimePetTheme = {
      ...theme,
      animations: { idle: theme.animations.idle },
      fallbacks: { approval: "waiting_input", waiting_input: "approval" },
    };
    expect(resolvePetAnimation(cyclic, "approval").state).toBe("idle");
  });
});
