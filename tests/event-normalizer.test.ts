import { describe, expect, it } from "vitest";
import { EventNormalizer } from "../src/core/codex/event-normalizer";

describe("EventNormalizer", () => {
  const normalizer = new EventNormalizer();

  it("maps known local protocol semantics to domain events", () => {
    expect(
      normalizer.normalizeNotification("turn/started", { threadId: "t", turn: { id: "x" } })[0],
    ).toMatchObject({ type: "pet-state", state: "thinking", threadId: "t" });
    expect(
      normalizer.normalizeNotification("item/commandExecution/started", {
        threadId: "t",
        turnId: "x",
      })[0],
    ).toMatchObject({ state: "working" });
    expect(
      normalizer.normalizeNotification("item/fileChange/started", { threadId: "t" })[0],
    ).toMatchObject({ state: "typing" });
    expect(
      normalizer.normalizeNotification("turn/completed", {
        threadId: "t",
        turn: { status: "completed" },
      })[0],
    ).toMatchObject({ state: "success" });
  });

  it("forwards token usage but leaves unknown notifications as diagnostics only", () => {
    expect(
      normalizer.normalizeNotification("thread/tokenUsage/updated", {
        threadId: "t",
        tokenUsage: { total: 9 },
      })[0],
    ).toMatchObject({ type: "token-usage", threadId: "t" });
    expect(normalizer.normalizeNotification("future/unknown", { secret: "payload" })).toEqual([
      { type: "diagnostic", code: "unknown-notification", method: "future/unknown" },
    ]);
  });
});
