import { describe, expect, it } from "vitest";
import { parseDeveloperCwdSelection, parseVerificationKind } from "../src/main/ipc-validation";

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
});
