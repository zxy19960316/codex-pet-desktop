import { describe, expect, it } from "vitest";
import { wheelScaleStep } from "../src/renderer/pet/pet-scale-wheel";

describe("Ctrl + wheel pet scaling", () => {
  it("changes one step only while Ctrl is pressed", () => {
    expect(wheelScaleStep({ ctrlKey: true, deltaY: -120 })).toBe(1);
    expect(wheelScaleStep({ ctrlKey: true, deltaY: 120 })).toBe(-1);
    expect(wheelScaleStep({ ctrlKey: false, deltaY: -120 })).toBe(0);
    expect(wheelScaleStep({ ctrlKey: true, deltaY: 0 })).toBe(0);
  });
});
