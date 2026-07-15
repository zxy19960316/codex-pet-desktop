import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodexRpcClient } from "../src/core/codex/control-types";
import { ThreadController } from "../src/core/codex/thread-controller";
import { TurnController } from "../src/core/codex/turn-controller";

const temporaryPaths: string[] = [];

async function setup() {
  const projectRoot = mkdtempSync(join(tmpdir(), "codex-pet-turn-"));
  temporaryPaths.push(projectRoot);
  const threads = new ThreadController(projectRoot);
  const sendRequest = vi.fn(async (method: string, params?: unknown): Promise<unknown> => {
    void params;
    if (method === "thread/start") return { thread: { id: "thread", cwd: projectRoot } };
    if (method === "collaborationMode/list")
      return {
        data: [{ name: "Plan", mode: "plan", model: "gpt-test", reasoning_effort: "medium" }],
      };
    return { turn: { id: "turn" } };
  });
  const client: CodexRpcClient = {
    sendRequest: sendRequest as unknown as CodexRpcClient["sendRequest"],
  };
  await threads.create({ cwd: { kind: "project-root" } }, client);
  return { client, sendRequest, turns: new TurnController(threads), threads };
}

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("TurnController", () => {
  it("starts an approval test with a fixed harmless prompt", async () => {
    const { client, sendRequest, turns, threads } = await setup();
    await expect(
      turns.start({ threadId: "thread", prompt: "ignored", mode: "approval-test" }, client),
    ).resolves.toBe("turn");
    expect(sendRequest).toHaveBeenLastCalledWith(
      "turn/start",
      expect.objectContaining({
        threadId: "thread",
        input: [
          expect.objectContaining({
            text: expect.stringContaining("m2-6-nonexistent-probe"),
          }),
        ],
      }),
    );
    const request = sendRequest.mock.calls.at(-1)?.[1] as {
      input?: Array<{ text?: string }>;
    };
    expect(request.input?.[0]?.text).toContain("normal sandbox flow");
    expect(request.input?.[0]?.text).toContain("guaranteed not to exist");
    expect(threads.get("thread")?.activeTurnId).toBe("turn");
  });

  it("uses fixed no-tool prompts for input, steer, and interrupt verification", async () => {
    const modes = ["input-test", "steer-test", "interrupt-test"] as const;
    for (const mode of modes) {
      const { client, sendRequest, turns } = await setup();
      await turns.start({ threadId: "thread", prompt: "ignored", mode }, client);
      const request = sendRequest.mock.calls.at(-1)?.[1] as {
        input: Array<{ text: string }>;
      };
      expect(request.input[0].text).toContain("Do not");
      expect(request.input[0].text).not.toContain("git push");
      if (mode === "input-test")
        expect(request).toMatchObject({
          collaborationMode: {
            mode: "plan",
            settings: { model: "gpt-test", reasoning_effort: "medium" },
          },
        });
    }
  });

  it("requires exact active turn ownership for steer and interrupt", async () => {
    const { client, sendRequest, turns } = await setup();
    await turns.start({ threadId: "thread", prompt: "hello", mode: "normal" }, client);
    await expect(
      turns.steer({ threadId: "thread", expectedTurnId: "other", message: "focus" }, client),
    ).rejects.toThrow("changed");
    await turns.steer({ threadId: "thread", expectedTurnId: "turn", message: "focus" }, client);
    expect(sendRequest).toHaveBeenLastCalledWith(
      "turn/steer",
      expect.objectContaining({ threadId: "thread", expectedTurnId: "turn" }),
    );
    await turns.interrupt({ threadId: "thread", turnId: "turn" }, client);
    expect(sendRequest).toHaveBeenLastCalledWith("turn/interrupt", {
      threadId: "thread",
      turnId: "turn",
    });
  });

  it("does not send blank or control-character messages", async () => {
    const { client, sendRequest, turns } = await setup();
    await expect(
      turns.start({ threadId: "thread", prompt: "\0", mode: "normal" }, client),
    ).rejects.toThrow("must not be empty");
    expect(sendRequest).toHaveBeenCalledTimes(1);
  });
});
