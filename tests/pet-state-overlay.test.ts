import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PET_STATES } from "../src/core/pet/pet-state";
import { Pet } from "../src/renderer/pet/Pet";
import { PetStateOverlay } from "../src/renderer/pet/PetStateOverlay";

describe("pet state overlay", () => {
  it("renders a separate original marker for every normalized state", () => {
    expect(PET_STATES).toHaveLength(12);
    for (const state of PET_STATES) {
      const markup = renderToStaticMarkup(createElement(PetStateOverlay, { state }));
      expect(markup).toContain(`data-overlay-state="${state}"`);
      expect(markup).toContain(`pet-state-overlay--${state}`);
    }
  });

  it("keeps the overlay beside the sprite for a fallback pet instead of replacing animation", () => {
    const markup = renderToStaticMarkup(createElement(Pet, { state: "working" }));
    expect(markup).toContain("pet-sprite");
    expect(markup).toContain('data-animation-state="unavailable"');
    expect(markup).toContain('data-overlay-state="working"');
  });

  it("disables motion and pointer capture through CSS", async () => {
    const css = await readFile(
      join(process.cwd(), "src", "renderer", "pet", "pet-state-overlay.css"),
      "utf8",
    );
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*animation:\s*none/);
  });
});
