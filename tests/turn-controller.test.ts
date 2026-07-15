import { describe, expect, it, vi } from "vitest";
import { ThreadController } from "../src/core/codex/thread-controller";
import { TurnController } from "../src/core/codex/turn-controller";

async function setup() {
  const threads = new ThreadController("C:/work/codex-pet");
  const client = {
    sendRequest: vi
      .fn()
      .mockResolvedValueOnce({ thread: { id: "thread", cwd: "C:/work/codex-pet" } })
      .mockResolvedValue({ turn: { id: "turn" } }),
  };
  await threads.create({ cwd: "C:/work/codex-pet" }, client);
  return { client, turns: new TurnController(threads), threads };
}

describe("TurnController", () => {
  it("starts an approval test with a fixed harmless prompt", async () => {
    const { client, turns, threads } = await setup();
    await expect(
      turns.start({ threadId: "thread", prompt: "ignored", mode: "approval-test" }, client),
    ).resolves.toBe("turn");
    expect(client.sendRequest).toHaveBeenLastCalledWith(
      "turn/start",
      expect.objectContaining({
        threadId: "thread",
        input: [expect.objectContaining({ text: expect.stringContaining("node --version") })],
      }),
    );
    expect(threads.get("thread")?.activeTurnId).toBe("turn");
  });

  it("uses a fixed no-tool user-input prompt for the input test", async () => {
    const { client, turns } = await setup();
    await turns.start({ threadId: "thread", prompt: "ignored", mode: "input-test" }, client);
    const request = client.sendRequest.mock.calls.at(-1)?.[1] as {
      input: Array<{ text: string }>;
    };
    expect(request.input[0].text).toContain("request_user_input");
    expect(request.input[0].text).toContain("Do not run commands");
    expect(request.input[0].text).not.toContain("git push");
  });

  it("requires exact active turn ownership for steer and interrupt", async () => {
    const { client, turns } = await setup();
    await turns.start({ threadId: "thread", prompt: "hello", mode: "normal" }, client);
    await expect(
      turns.steer({ threadId: "thread", expectedTurnId: "other", message: "focus" }, client),
    ).rejects.toThrow("changed");
    await turns.steer({ threadId: "thread", expectedTurnId: "turn", message: "focus" }, client);
    expect(client.sendRequest).toHaveBeenLastCalledWith(
      "turn/steer",
      expect.objectContaining({ threadId: "thread", expectedTurnId: "turn" }),
    );
    await turns.interrupt({ threadId: "thread", turnId: "turn" }, client);
    expect(client.sendRequest).toHaveBeenLastCalledWith("turn/interrupt", {
      threadId: "thread",
      turnId: "turn",
    });
  });

  it("does not send blank or control-character messages", async () => {
    const { client, turns } = await setup();
    await expect(
      turns.start({ threadId: "thread", prompt: "\0", mode: "normal" }, client),
    ).rejects.toThrow("must not be empty");
    expect(client.sendRequest).toHaveBeenCalledTimes(1);
  });
});
