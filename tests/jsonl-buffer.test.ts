import { describe, expect, it } from "vitest";
import { JsonLineBuffer } from "../src/core/codex/jsonl-buffer";

describe("JsonLineBuffer", () => {
  it("holds a half line until the remaining chunk arrives", () => {
    const buffer = new JsonLineBuffer();
    expect(buffer.push('{"id":1')).toEqual([]);
    expect(buffer.push("}\n")).toEqual(['{"id":1}']);
  });

  it("returns multiple CRLF or LF terminated lines", () => {
    const buffer = new JsonLineBuffer();
    expect(buffer.push("one\r\ntwo\nthree\n")).toEqual(["one", "two", "three"]);
  });

  it("exposes an unterminated final line only when flushed", () => {
    const buffer = new JsonLineBuffer();
    buffer.push("tail");
    expect(buffer.flush()).toBe("tail");
    expect(buffer.flush()).toBeNull();
  });
});
