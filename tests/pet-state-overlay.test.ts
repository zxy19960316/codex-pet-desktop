import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pet } from "../src/renderer/pet/Pet";

describe("pet visual shell", () => {
  it("uses the animation without a separate circular state-symbol overlay", () => {
    const markup = renderToStaticMarkup(createElement(Pet, { state: "sleep" }));
    expect(markup).toContain("pet-sprite");
    expect(markup).toContain('data-animation-state="unavailable"');
    expect(markup).not.toContain("pet-state-overlay");
    expect(markup).not.toContain('data-overlay-state="sleep"');
    expect(markup).toContain("Sleeping");
  });

  it("allocates a scaled sprite slot and excludes overlay selectors from the shape reporter", async () => {
    const markup = renderToStaticMarkup(createElement(Pet, { state: "working" }));
    expect(markup).toContain("pet-sprite-slot");
    const [entry, reporter] = await Promise.all([
      readFile(join(process.cwd(), "src", "renderer", "main.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "renderer", "pet", "window-shape-reporter.ts"), "utf8"),
    ]);
    expect(entry).not.toContain("pet-state-overlay.css");
    expect(reporter).not.toContain(".pet-state-overlay");
  });
});
