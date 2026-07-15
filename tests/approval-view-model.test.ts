import { describe, expect, it } from "vitest";
import type { ApprovalRequest } from "../src/core/codex/approval-router";
import {
  approvalDecisionOptions,
  summarizePaths,
} from "../src/renderer/approval/approval-view-model";

function request(availableDecisions: ApprovalRequest["availableDecisions"]): ApprovalRequest {
  return {
    requestId: "r",
    threadId: "t",
    kind: "command",
    title: "Approval",
    availableDecisions,
    receivedAt: 1,
  };
}

describe("approval view model", () => {
  it("renders only server-offered decisions", () => {
    expect(approvalDecisionOptions(request(["decline", "cancel"]))).toEqual([
      { decision: "decline", label: "Deny", primary: false },
      { decision: "cancel", label: "Cancel", primary: false },
    ]);
  });

  it("summarizes long affected-path lists without discarding the count", () => {
    expect(summarizePaths(["a", "b", "c"], 2)).toEqual({
      visible: ["a", "b"],
      remaining: 1,
    });
  });
});
