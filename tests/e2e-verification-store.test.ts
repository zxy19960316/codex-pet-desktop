import { describe, expect, it } from "vitest";
import { E2EVerificationStore } from "../src/core/codex/e2e-verification-store";

describe("E2EVerificationStore", () => {
  it("tracks all five verification kinds with redacted identifiers and protocol-only evidence", () => {
    const store = new E2EVerificationStore({ now: () => 100 });
    expect(store.steps().map((step) => step.kind)).toEqual([
      "approval-allow",
      "approval-deny",
      "user-input",
      "steer",
      "interrupt",
    ]);

    const record = store.start("steer", {
      threadId: "private-thread-id",
      turnId: "private-turn-id",
      requestId: "private-request-id",
    });
    store.waitForUser(record.id, "turn/start");
    store.pass(record.id, ["turn/steer", "final-reply-steered"]);

    expect(store.snapshot()).toEqual([
      expect.objectContaining({
        id: record.id,
        kind: "steer",
        result: "passed",
        threadIdHash: expect.stringMatching(/^[a-f0-9]{12}$/),
        turnIdHash: expect.stringMatching(/^[a-f0-9]{12}$/),
        requestIdHash: expect.stringMatching(/^[a-f0-9]{12}$/),
        protocolEvidence: ["turn/start", "turn/steer", "final-reply-steered"],
      }),
    ]);
    expect(JSON.stringify(store.snapshot())).not.toContain("private-");
  });

  it("permits failed-to-running-to-passed retry without retaining unsafe evidence", () => {
    const store = new E2EVerificationStore({ now: () => 100 });
    const failed = store.start("approval-allow", { threadId: "thread" });
    store.fail(failed.id, "approval-not-requested", ["unexpected event body"]);
    const retried = store.start("approval-allow", { threadId: "thread-2" });
    store.pass(retried.id, ["item/commandExecution/requestApproval", "turn/completed"]);

    expect(store.steps().find((step) => step.kind === "approval-allow")).toEqual({
      kind: "approval-allow",
      state: "passed",
      recordId: retried.id,
    });
    expect(store.snapshot().map((record) => record.result)).toEqual(["passed", "failed"]);
    expect(store.snapshot()[1]?.protocolEvidence).toEqual([]);
  });
});
