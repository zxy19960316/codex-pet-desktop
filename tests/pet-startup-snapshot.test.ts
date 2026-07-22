import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("pet startup snapshot", () => {
  it("decorates the initial desktop IPC snapshot with the active registry pet", async () => {
    const source = await readFile(join(process.cwd(), "src", "main", "index.ts"), "utf8");
    expect(source).toContain("getSnapshot: () => withPetSnapshot(runtime.getSnapshot())");
  });
});
