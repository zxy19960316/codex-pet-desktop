import { afterEach, describe, expect, it, vi } from "vitest";
import { InputRouter } from "../src/core/input/input-router";

const params = (threadId = "thread-a", turnId = "turn-a") => ({
  threadId,
  turnId,
  itemId: "item-a",
  autoResolutionMs: null,
  questions: [
    {
      id: "answer",
      header: "Header",
      question: "Pick one",
      isOther: false,
      isSecret: false,
      options: [{ label: "Yes", description: "yes" }],
    },
  ],
});

afterEach(() => vi.useRealTimers());

describe("InputRouter", () => {
  it("queues explicit request IDs and resolves only a validated matching response", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const router = new InputRouter();
    router.enqueue("a", "item/tool/requestUserInput", params(), first);
    router.enqueue("b", "item/tool/requestUserInput", params("thread-b", "turn-b"), second);
    await router.respond("a", { answers: [{ questionId: "answer", selectedOptionIds: ["Yes"] }] });
    expect(first).toHaveBeenCalledWith({ answers: { answer: { answers: ["Yes"] } } });
    expect(second).not.toHaveBeenCalled();
    expect(router.snapshot().map((request) => request.requestId)).toEqual(["b"]);
    expect(() => router.enqueue("b", "item/tool/requestUserInput", params(), vi.fn())).toThrow(
      "already pending",
    );
  });

  it("cleans pending inputs after cancellation, timeout, turn/thread completion, and disconnect", async () => {
    vi.useFakeTimers();
    const rejects = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    const router = new InputRouter();
    router.enqueue(
      "timeout",
      "item/tool/requestUserInput",
      { ...params(), autoResolutionMs: 10 },
      vi.fn(),
      rejects[0],
    );
    router.enqueue("turn", "item/tool/requestUserInput", params(), vi.fn(), rejects[1]);
    router.enqueue(
      "thread",
      "item/tool/requestUserInput",
      params("thread-b", "turn-b"),
      vi.fn(),
      rejects[2],
    );
    router.enqueue(
      "all",
      "item/tool/requestUserInput",
      params("thread-c", "turn-c"),
      vi.fn(),
      rejects[3],
    );
    router.clearByTurn("thread-a", "turn-a");
    router.clearByThread("thread-b");
    router.clearAll("App Server disconnected");
    await vi.advanceTimersByTimeAsync(11);
    expect(router.snapshot()).toEqual([]);
    expect(rejects.map((reject) => reject.mock.calls.length)).toEqual([1, 1, 1, 1]);
  });

  it("does not resolve a cancelled request later and blocks duplicate sends", async () => {
    const resolve = vi.fn();
    const router = new InputRouter();
    router.enqueue("a", "item/tool/requestUserInput", params(), resolve);
    await router.cancel("a");
    expect(resolve).toHaveBeenCalledWith({ answers: {} });
    await expect(router.respond("a", { answers: [] })).rejects.toThrow("not found");
  });
});
