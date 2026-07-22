import { describe, expect, it } from "vitest";
import { arbitrateSessionAttention } from "../src/core/sessions/attention-arbiter";

describe("attention arbiter", () => {
  it("prioritizes input and keeps working above another session success", () => {
    const attention = arbitrateSessionAttention({
      generatedAt: 10,
      sessions: [
        { sessionId: "success", state: "success", lastActivityAt: 9 },
        { sessionId: "work", state: "working", lastActivityAt: 8 },
        { sessionId: "input", state: "waiting_input", lastActivityAt: 7, requiresAttention: true },
      ] as never,
    });
    expect(attention).toMatchObject({
      primarySessionId: "input",
      primaryState: "waiting_input",
      concurrencyLevel: 2,
      presentationHint: "needs-attention",
      counts: { working: 1, waitingInputs: 1 },
    });
  });
});
