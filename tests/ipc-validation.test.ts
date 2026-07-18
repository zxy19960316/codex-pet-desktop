import { describe, expect, it } from "vitest";
import { parseDeveloperCwdSelection, parseVerificationKind } from "../src/main/ipc-validation";
import { parsePetScaleDelta } from "../src/main/ipc-handlers";

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
});
