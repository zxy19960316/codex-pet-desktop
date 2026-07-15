import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)],
    ),
  );
  return files.flat();
}

describe("renderer security boundary", () => {
  it("does not import Electron or Node.js APIs", async () => {
    const files = (await filesUnder(join(process.cwd(), "src", "renderer"))).filter((file) =>
      /\.[cm]?[jt]sx?$/.test(file),
    );
    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (/from\s+["'](?:electron|node:|fs["']|path["'])|\brequire\s*\(|\bprocess\./.test(source))
        violations.push(file);
    }
    expect(violations).toEqual([]);
  });
});
