import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionActivityStore } from "../src/main/session-activity-store";

describe("session activity store", () => {
  it("persists only a bounded daily aggregate and rolls over dates", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-pet-session-"));
    const path = join(directory, "activity.json");
    const store = new SessionActivityStore(path, "2026-07-22");
    store.add(300, "2026-07-22");
    await store.flush();
    expect(await new SessionActivityStore(path, "2026-07-22").load("2026-07-22")).toEqual({
      schemaVersion: 1,
      date: "2026-07-22",
      activeMs: 300,
    });
    store.add(300, "2026-07-23");
    expect(store.snapshot).toEqual({ schemaVersion: 1, date: "2026-07-23", activeMs: 300 });
  });
});
