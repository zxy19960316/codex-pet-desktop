import { describe, expect, it } from "vitest";
import { buildPetWindowShape, buildRenderedWindowShape } from "../src/main/pet-window-shape";

function bitmap(width: number, height: number, opaque: Array<[number, number]>): Buffer {
  const value = Buffer.alloc(width * height * 4);
  for (const [x, y] of opaque) value[(y * width + x) * 4 + 3] = 255;
  return value;
}

describe("pixel-accurate pet window shape", () => {
  it("turns alpha runs into scaled rectangles and merges identical vertical runs", () => {
    const shape = buildPetWindowShape({
      bitmap: {
        width: 4,
        height: 3,
        pixels: bitmap(4, 3, [
          [1, 0],
          [2, 0],
          [1, 1],
          [2, 1],
          [3, 2],
        ]),
      },
      frame: { width: 4, height: 3, index: 0, row: 0 },
      spriteRect: { x: 10, y: 20, width: 8, height: 6 },
      uiRects: [{ x: 2, y: 3, width: 9, height: 7 }],
    });

    expect(shape).toEqual([
      { x: 12, y: 20, width: 4, height: 4 },
      { x: 16, y: 24, width: 2, height: 2 },
      { x: 2, y: 3, width: 9, height: 7 },
    ]);
  });

  it("uses the requested atlas frame and ignores fully transparent pixels", () => {
    const pixels = bitmap(8, 3, [
      [0, 0],
      [6, 1],
    ]);
    expect(
      buildPetWindowShape({
        bitmap: { width: 8, height: 3, pixels },
        frame: { width: 4, height: 3, index: 1, row: 0 },
        spriteRect: { x: 0, y: 0, width: 4, height: 3 },
        uiRects: [],
      }),
    ).toEqual([{ x: 2, y: 1, width: 1, height: 1 }]);
  });

  it("maps a high-DPI rendered capture back into renderer coordinates", () => {
    expect(
      buildRenderedWindowShape({
        bitmap: { width: 4, height: 4, pixels: bitmap(4, 4, [[2, 2]]) },
        captureRect: { x: 10, y: 20, width: 2, height: 2 },
        spriteFallbackRect: { x: 10.4, y: 20.4, width: 1.2, height: 1.2 },
        uiRects: [{ x: 2, y: 3, width: 9, height: 7 }],
      }),
    ).toEqual([
      { x: 11, y: 21, width: 1, height: 1 },
      { x: 2, y: 3, width: 9, height: 7 },
    ]);
  });

  it("keeps the pet visible when rendered alpha capture is empty", () => {
    expect(
      buildRenderedWindowShape({
        bitmap: { width: 4, height: 4, pixels: bitmap(4, 4, []) },
        captureRect: { x: 8, y: 18, width: 4, height: 4 },
        spriteFallbackRect: { x: 10.4, y: 20.4, width: 1.2, height: 1.2 },
        uiRects: [],
      }),
    ).toEqual([{ x: 10, y: 20, width: 2, height: 2 }]);
  });
});
