import { readFile } from "node:fs/promises";
import type { CodexHookEvent } from "../core/codex/hook-event";

export class HookEventBridge {
  readonly #path: string;
  readonly #onEvent: (event: CodexHookEvent) => void;
  #timer?: ReturnType<typeof setInterval>;
  #consumed = 0;
  #initialized = false;

  constructor(path: string, onEvent: (event: CodexHookEvent) => void) {
    this.#path = path;
    this.#onEvent = onEvent;
  }

  start(intervalMs = 250): void {
    if (this.#timer) return;
    void this.#poll();
    this.#timer = setInterval(() => void this.#poll(), intervalMs);
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  async #poll(): Promise<void> {
    try {
      const content = await readFile(this.#path, "utf8");
      if (!this.#initialized) {
        this.#initialized = true;
        this.#consumed = content.length;
        return;
      }
      if (content.length < this.#consumed) this.#consumed = 0;
      const appended = content.slice(this.#consumed);
      this.#consumed = content.length;
      for (const line of appended.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as CodexHookEvent;
          if (event.sessionId && event.name && Number.isFinite(event.timestamp))
            this.#onEvent(event);
        } catch {
          // Ignore a partial or malformed line; hook input is never trusted as app data.
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") this.#initialized = true;
      else throw error;
    }
  }
}
