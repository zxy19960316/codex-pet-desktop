import { describe, expect, it } from "vitest";
import {
  buildPetMenuTemplate,
  type PetMenuItem,
  type PetMenuViewModel,
} from "../src/main/menu/menu-view-model";

function viewModel(overrides: Partial<PetMenuViewModel> = {}): PetMenuViewModel {
  return {
    statusLabel: "Current: Working · 2 threads",
    pets: [
      { id: "pixel-sprout", name: "Pixel Sprout", active: true },
      { id: "geo-bot", name: "Geo Bot", active: false },
    ],
    scalePercent: 125,
    hudVisible: false,
    alwaysOnTop: true,
    clickThrough: false,
    hasApproval: false,
    hasUserInput: false,
    ...overrides,
  };
}

function find(items: PetMenuItem[], label: string): PetMenuItem | undefined {
  for (const item of items) {
    if (item.label === label) return item;
    const nested = item.submenu ? find(item.submenu, label) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

function labels(items: PetMenuItem[]): string[] {
  return items.flatMap((item) => [item.label ?? "", ...(item.submenu ? labels(item.submenu) : [])]);
}

describe("dynamic pet menu", () => {
  it("checks the active pet and current preset without duplicating selection logic", () => {
    const menu = buildPetMenuTemplate(viewModel(), "pet");
    expect(menu[0]).toMatchObject({ label: "Current: Working · 2 threads", enabled: false });
    expect(find(menu, "Pixel Sprout")).toMatchObject({ type: "radio", checked: true });
    expect(find(menu, "Geo Bot")).toMatchObject({ type: "radio", checked: false });
    expect(find(menu, "125%")).toMatchObject({ type: "radio", checked: true });
    expect(find(menu, "100%")).toMatchObject({ type: "radio", checked: false });
  });

  it("shows only real approval and reply actions", () => {
    expect(
      find(buildPetMenuTemplate(viewModel({ hasApproval: true }), "pet"), "Open approval"),
    ).toBeDefined();
    expect(
      find(buildPetMenuTemplate(viewModel({ hasUserInput: true }), "pet"), "Reply to Codex"),
    ).toBeDefined();
    const idle = labels(buildPetMenuTemplate(viewModel(), "pet"));
    expect(idle).not.toContain("Open approval");
    expect(idle).not.toContain("Reply to Codex");
  });

  it("enables interruption only when an actual active turn exists", () => {
    expect(
      find(buildPetMenuTemplate(viewModel(), "pet"), "Interrupt current turn"),
    ).toBeUndefined();
    expect(
      find(
        buildPetMenuTemplate(
          viewModel({ activeTurn: { threadId: "thread-1", turnId: "turn-1" } }),
          "pet",
        ),
        "Interrupt current turn",
      ),
    ).toMatchObject({
      action: { type: "interrupt-turn", threadId: "thread-1", turnId: "turn-1" },
    });
  });

  it("keeps click-through recovery, default size, settings, and exit in the tray", () => {
    const tray = buildPetMenuTemplate(viewModel({ clickThrough: true, scalePercent: 173 }), "tray");
    expect(find(tray, "Click-through")).toMatchObject({ type: "checkbox", checked: true });
    expect(find(tray, "Restore default size")?.action).toEqual({
      type: "set-scale",
      scalePercent: 100,
    });
    expect(find(tray, "Open Settings Center")).toBeDefined();
    expect(find(tray, "Exit")).toBeDefined();
    expect(labels(tray)).not.toContain("Pause notifications");
  });
});
