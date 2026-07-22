import { describe, expect, it } from "vitest";
import { parseDeveloperCwdSelection, parseVerificationKind } from "../src/main/ipc-validation";
import { parsePetScaleDelta, parseWindowShapeRequest } from "../src/main/ipc-handlers";

describe("IPC validation", () => {
  it("accepts only opaque cwd selections and rejects absolute renderer paths", () => {
    expect(parseDeveloperCwdSelection({ kind: "project-root" })).toEqual({
      kind: "project-root",
    });
    expect(
      parseDeveloperCwdSelection({ kind: "project-relative", relativePath: "examples/demo" }),
    ).toEqual({ kind: "project-relative", relativePath: "examples/demo" });
    expect(() =>
      parseDeveloperCwdSelection({ kind: "project-relative", relativePath: "C:\\Users\\private" }),
    ).toThrow("Invalid project-relative cwd");
    expect(() =>
      parseDeveloperCwdSelection({ kind: "project-relative", relativePath: "/system" }),
    ).toThrow("Invalid project-relative cwd");
  });

  it("accepts exactly the five guided verification kinds", () => {
    expect(parseVerificationKind("interrupt")).toBe("interrupt");
    expect(() => parseVerificationKind("release")).toThrow("Invalid verification kind");
  });

  it("accepts only bounded integer pet scale steps", () => {
    expect(parsePetScaleDelta(1)).toBe(1);
    expect(parsePetScaleDelta(-10)).toBe(-10);
    expect(() => parsePetScaleDelta(0)).toThrow("Invalid pet scale delta");
    expect(() => parsePetScaleDelta(11)).toThrow("Invalid pet scale delta");
    expect(() => parsePetScaleDelta(1.5)).toThrow("Invalid pet scale delta");
  });

  it("accepts bounded renderer shape geometry and rejects oversized requests", () => {
    expect(
      parseWindowShapeRequest({
        frameIndex: 3,
        spriteRect: { x: 10.5, y: 20, width: 192, height: 208 },
        uiRects: [{ x: 4, y: 5, width: 180, height: 60 }],
      }),
    ).toEqual({
      frameIndex: 3,
      spriteRect: { x: 10.5, y: 20, width: 192, height: 208 },
      uiRects: [{ x: 4, y: 5, width: 180, height: 60 }],
    });
    expect(() =>
      parseWindowShapeRequest({
        frameIndex: 0,
        spriteRect: { x: 0, y: 0, width: 10, height: 10 },
        uiRects: Array.from({ length: 33 }, () => ({ x: 0, y: 0, width: 1, height: 1 })),
      }),
    ).toThrow("Invalid window shape rectangles");
    expect(() =>
      parseWindowShapeRequest({
        frameIndex: -1,
        spriteRect: { x: 0, y: 0, width: 10, height: 10 },
        uiRects: [],
      }),
    ).toThrow("Invalid animation frame");
  });
});
