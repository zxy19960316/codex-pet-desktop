import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";

const run = promisify(execFile);

describe("original application icon", () => {
  it("generates a 256px PNG and a multi-size Windows ICO", async () => {
    const root = process.cwd();
    const generated = join(root, "build", "generated");
    await rm(generated, { recursive: true, force: true });

    const result = await run(process.execPath, [join(root, "scripts", "generate-app-icons.mjs")], {
      cwd: root,
    });
    const report = JSON.parse(result.stdout) as { source: string };
    expect(report.source).toBe(join(root, "assets", "branding", "cloud-terminal-pet-source.png"));

    const png = await readFile(join(generated, "icon.png"));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(256);
    expect(png.readUInt32BE(20)).toBe(256);
    const decoded = PNG.sync.read(png);
    const cornerAlpha = [
      decoded.data[3],
      decoded.data[(decoded.width - 1) * 4 + 3],
      decoded.data[(decoded.height - 1) * decoded.width * 4 + 3],
      decoded.data[(decoded.width * decoded.height - 1) * 4 + 3],
    ];
    expect(cornerAlpha).toEqual([0, 0, 0, 0]);
    expect(decoded.data[(128 * decoded.width + 128) * 4 + 3]).toBeGreaterThan(200);

    const tray = PNG.sync.read(await readFile(join(generated, "tray-icon.png")));
    expect({ width: tray.width, height: tray.height }).toEqual({ width: 32, height: 32 });
    expect(tray.data[3]).toBe(0);

    const ico = await readFile(join(generated, "icon.ico"));
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, index) => {
      const size = ico[6 + index * 16];
      return size === 0 ? 256 : size;
    });
    expect(sizes.sort((left, right) => left - right)).toEqual([16, 24, 32, 48, 64, 128, 256]);

    const trayManager = await readFile(join(root, "src", "main", "tray-manager.ts"), "utf8");
    expect(trayManager).toContain("nativeImage.createFromPath");
    expect(trayManager).not.toContain("data:image/svg+xml");
  });
});
