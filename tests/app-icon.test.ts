import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);

describe("original application icon", () => {
  it("generates a 256px PNG and a multi-size Windows ICO", async () => {
    const root = process.cwd();
    const generated = join(root, "build", "generated");
    await rm(generated, { recursive: true, force: true });

    await run(process.execPath, [join(root, "scripts", "generate-app-icons.mjs")], { cwd: root });

    const png = await readFile(join(generated, "icon.png"));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(256);
    expect(png.readUInt32BE(20)).toBe(256);

    const ico = await readFile(join(generated, "icon.ico"));
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, index) => {
      const size = ico[6 + index * 16];
      return size === 0 ? 256 : size;
    });
    expect(sizes.sort((left, right) => left - right)).toEqual([16, 24, 32, 48, 64, 128, 256]);
  });
});
