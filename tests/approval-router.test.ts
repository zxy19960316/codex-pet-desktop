import { afterEach, describe, expect, it, vi } from "vitest";
import { ApprovalRouter, buildApprovalResponse } from "../src/core/codex/approval-router";

afterEach(() => vi.useRealTimers());

describe("ApprovalRouter", () => {
  it("binds command approvals to explicit request/thread/turn/item IDs", () => {
    const router = new ApprovalRouter();
    const request = router.enqueue("rpc-7", "item/commandExecution/requestApproval", {
      threadId: "thread-1",
      turnId: "turn-2",
      itemId: "item-3",
      command: "npm test",
      cwd: "D:/work",
      availableDecisions: ["accept", "decline", "cancel"],
    });
    expect(request).toMatchObject({
      requestId: "rpc-7",
      threadId: "thread-1",
      turnId: "turn-2",
      itemId: "item-3",
      kind: "command",
      command: "npm test",
    });
  });

  it("queues multiple requests and removes only the resolved request", () => {
    const router = new ApprovalRouter();
    router.enqueue("a", "item/fileChange/requestApproval", { threadId: "t", paths: ["a.ts"] });
    router.enqueue("b", "item/permissions/requestApproval", {
      threadId: "t",
      networkTargets: ["https://example.test"],
    });
    router.resolve("a");
    expect(router.getQueue().map((item) => item.requestId)).toEqual(["b"]);
  });

  it("cleans up an approval after its server timeout", async () => {
    vi.useFakeTimers();
    const router = new ApprovalRouter();
    router.enqueue("a", "item/commandExecution/requestApproval", {
      threadId: "t",
      autoResolutionMs: 50,
    });
    await vi.advanceTimersByTimeAsync(51);
    expect(router.getQueue()).toEqual([]);
  });

  it("responds with an offered decision and rejects scope expansion", async () => {
    const respond = vi.fn().mockResolvedValue(undefined);
    const router = new ApprovalRouter({ respond });
    router.enqueue("a", "item/permissions/requestApproval", {
      threadId: "t",
      availableDecisions: ["accept", "decline"],
    });
    await expect(router.respond("a", "acceptForSession")).rejects.toThrow("not offered");
    await expect(router.respond("a", "accept")).resolves.toBeUndefined();
    expect(respond).toHaveBeenCalledWith(
      "a",
      "accept",
      expect.objectContaining({ kind: "permissions" }),
    );
  });

  it("uses the real permission response shape without granting null or denied capabilities", () => {
    const router = new ApprovalRouter();
    const request = router.enqueue("a", "item/permissions/requestApproval", {
      threadId: "t",
      permissions: {
        network: { enabled: true },
        fileSystem: null,
      },
    });
    expect(buildApprovalResponse("accept", request)).toEqual({
      permissions: { network: { enabled: true } },
      scope: "turn",
    });
    expect(buildApprovalResponse("decline", request)).toEqual({ permissions: {}, scope: "turn" });
  });
});
