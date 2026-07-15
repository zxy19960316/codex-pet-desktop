import type {
  CodexRpcClient,
  InterruptTurnRequest,
  StartTurnRequest,
  SteerTurnRequest,
} from "./control-types";
import { ThreadController } from "./thread-controller";

const APPROVAL_TEST_PROMPT = [
  "Developer verification task. Use the shell tool exactly once to run `codex --version` in the current working directory.",
  "Actually request the command through the normal sandbox flow; do not describe, simulate, bypass, or substitute it. If the App Server requests approval, wait for the human decision.",
  "Do not access the network, install anything, modify files, use Git, read credentials, or access paths outside the current directory.",
  "After the approval result, briefly report whether the command ran.",
].join(" ");

const INPUT_TEST_PROMPT = [
  "Developer verification task. Before continuing, call request_user_input exactly once with one harmless preference question.",
  "Offer options A and B and permit Other free text. After receiving an answer, reply with one short confirmation.",
  "Do not run commands, access the network, modify files, use Git, or read credentials.",
].join(" ");

const STEER_TEST_PROMPT = [
  "Developer verification task. Work through a multi-step plain-text outline.",
  "Wait for a steer instruction before the final reply and include the exact word STEERED.",
  "Do not use tools, access files or the network, modify files, use Git, or read credentials.",
].join(" ");

const INTERRUPT_TEST_PROMPT = [
  "Developer verification task. Produce a long multi-section plain-text outline.",
  "Do not use tools, access files or the network, modify files, use Git, or read credentials.",
].join(" ");

function safeText(value: string, label: string): string {
  if (!value || !value.trim() || value.includes("\0"))
    throw new Error(`${label} must not be empty`);
  if (
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    })
  )
    throw new Error(`${label} contains a control character`);
  return value.trim();
}

function input(text: string) {
  return [{ type: "text", text, text_elements: [] }];
}

export class TurnController {
  readonly #threads: ThreadController;
  readonly #sending = new Set<string>();

  constructor(threads: ThreadController) {
    this.#threads = threads;
  }

  async start(request: StartTurnRequest, client: CodexRpcClient): Promise<string> {
    const thread = this.#threads.get(request.threadId);
    if (!thread) throw new Error("Unknown Codex thread");
    if (thread.activeTurnId || this.#sending.has(request.threadId))
      throw new Error("The thread already has an active turn");
    const prompt =
      request.mode === "approval-test"
        ? APPROVAL_TEST_PROMPT
        : request.mode === "input-test"
          ? INPUT_TEST_PROMPT
          : request.mode === "steer-test"
            ? STEER_TEST_PROMPT
            : request.mode === "interrupt-test"
              ? INTERRUPT_TEST_PROMPT
              : safeText(request.prompt, "Prompt");
    this.#sending.add(request.threadId);
    try {
      const result = await client.sendRequest<{ turn?: { id?: unknown } }>("turn/start", {
        threadId: request.threadId,
        input: input(prompt),
      });
      if (!result.turn || typeof result.turn.id !== "string")
        throw new Error("App Server did not return a turn ID");
      this.#threads.markTurnStarted(request.threadId, result.turn.id);
      return result.turn.id;
    } finally {
      this.#sending.delete(request.threadId);
    }
  }

  async steer(request: SteerTurnRequest, client: CodexRpcClient): Promise<void> {
    const thread = this.#threads.get(request.threadId);
    if (!thread?.activeTurnId) throw new Error("The thread has no active turn");
    if (thread.activeTurnId !== request.expectedTurnId) throw new Error("The active turn changed");
    const message = safeText(request.message, "Steer message");
    if (this.#sending.has(request.threadId))
      throw new Error("A turn request is already being sent");
    this.#sending.add(request.threadId);
    try {
      await client.sendRequest("turn/steer", {
        threadId: request.threadId,
        expectedTurnId: request.expectedTurnId,
        input: input(message),
      });
    } finally {
      this.#sending.delete(request.threadId);
    }
  }

  async interrupt(request: InterruptTurnRequest, client: CodexRpcClient): Promise<void> {
    const thread = this.#threads.get(request.threadId);
    if (!thread?.activeTurnId || thread.activeTurnId !== request.turnId)
      throw new Error("The supplied turn is not active for this thread");
    if (this.#sending.has(request.threadId))
      throw new Error("A turn request is already being sent");
    this.#sending.add(request.threadId);
    try {
      await client.sendRequest("turn/interrupt", request);
    } finally {
      this.#sending.delete(request.threadId);
    }
  }

  clearSending(): void {
    this.#sending.clear();
  }
}
