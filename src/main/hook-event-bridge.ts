import { readFile } from "node:fs/promises";
import { CODEX_HOOK_EVENTS, type CodexHookEvent } from "../core/codex/hook-event";

const STARTUP_REPLAY_MAX_AGE_MS = 10 * 60 * 1_000;

function parseStoredHookEvent(line: string): CodexHookEvent | undefined {
  try {
    const event = JSON.parse(line) as Partial<CodexHookEvent>;
    if (
      typeof event.sessionId === "string" &&
      event.sessionId &&
      typeof event.name === "string" &&
      CODEX_HOOK_EVENTS.includes(event.name as CodexHookEvent["name"]) &&
      typeof event.timestamp === "number" &&
      Number.isFinite(event.timestamp)
    )
      return event as CodexHookEvent;
  } catch {
    // Stored hook data is untrusted; malformed lines are ignored.
  }
  return undefined;
}

export function recentHookEvents(
  content: string,
  now = Date.now(),
  maxAgeMs = STARTUP_REPLAY_MAX_AGE_MS,
): CodexHookEvent[] {
  return content
    .split(/\r?\n/)
    .map(parseStoredHookEvent)
    .filter((event): event is CodexHookEvent => {
      if (!event) return false;
      const age = now - event.timestamp;
      return age >= -60_000 && age <= maxAgeMs;
    });
}

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
        for (const event of recentHookEvents(content)) this.#onEvent(event);
        return;
      }
      if (content.length < this.#consumed) this.#consumed = 0;
      const appended = content.slice(this.#consumed);
      this.#consumed = content.length;
      for (const line of appended.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const event = parseStoredHookEvent(line);
        if (event) this.#onEvent(event);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") this.#initialized = true;
      else throw error;
    }
  }
}
