import { describe, expect, it } from "vitest";
import {
  computePetWindowBounds,
  inferPetWindowAnchor,
  type Rectangle,
} from "../src/main/pet-window-layout";

const workArea: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };

function bounds(overrides: Partial<Parameters<typeof computePetWindowBounds>[0]> = {}) {
  return computePetWindowBounds({
    frameWidth: 64,
    frameHeight: 64,
    scalePercent: 100,
    expanded: false,
    currentBounds: { x: 1620, y: 720, width: 300, height: 360 },
    displayWorkArea: workArea,
    anchor: "right-bottom",
    ...overrides,
  });
}

describe("pet window bounds", () => {
  it("links 50%, 100%, and 200% visual sizes to non-cropping compact bounds", () => {
    expect(bounds({ scalePercent: 50 })).toEqual({ x: 1752, y: 860, width: 168, height: 220 });
    expect(bounds({ scalePercent: 100 })).toEqual({ x: 1680, y: 764, width: 240, height: 316 });
    expect(bounds({ scalePercent: 200 })).toEqual({ x: 1488, y: 572, width: 432, height: 508 });
  });

  it("preserves left-bottom and right-bottom anchors", () => {
    expect(bounds({ scalePercent: 200, anchor: "left-bottom" })).toMatchObject({ x: 0, y: 572 });
    expect(bounds({ scalePercent: 200, anchor: "right-bottom" })).toMatchObject({
      x: 1488,
      y: 572,
    });
    expect(inferPetWindowAnchor({ x: 0, y: 720, width: 300, height: 360 }, workArea)).toBe(
      "left-bottom",
    );
  });

  it("keeps a free-position center and clamps it inside another display", () => {
    expect(
      bounds({
        scalePercent: 200,
        anchor: "free",
        currentBounds: { x: 100, y: 100, width: 300, height: 360 },
      }),
    ).toMatchObject({ x: 34, y: 26 });
    const secondary = bounds({
      displayWorkArea: { x: -1280, y: 40, width: 1280, height: 720 },
      currentBounds: { x: -40, y: 700, width: 300, height: 360 },
      scalePercent: 200,
      anchor: "free",
    });
    expect(secondary.x).toBeGreaterThanOrEqual(-1280);
    expect(secondary.y).toBeGreaterThanOrEqual(40);
    expect(secondary.x + secondary.width).toBeLessThanOrEqual(0);
    expect(secondary.y + secondary.height).toBeLessThanOrEqual(760);
  });

  it("recomputes for a different frame, expanded cards, and physical display compensation", () => {
    const atlas = bounds({ frameWidth: 192, frameHeight: 208, scalePercent: 100 });
    expect(atlas.width).toBeGreaterThanOrEqual(220);
    expect(atlas.height).toBeGreaterThanOrEqual(316);
    const expanded = bounds({ scalePercent: 200, expanded: true });
    expect(expanded.width).toBeGreaterThanOrEqual(420);
    expect(expanded.height).toBeGreaterThanOrEqual(700);
    const compensated = bounds({ scalePercent: 100, physicalScaleFactor: 2 });
    expect(compensated).toEqual(bounds({ scalePercent: 200 }));
  });

  it("never produces negative or non-finite dimensions", () => {
    const result = bounds({ frameWidth: Number.NaN, frameHeight: -1, scalePercent: 999 });
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(Object.values(result).every(Number.isFinite)).toBe(true);
  });
});
