import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseSessionTelemetry, type AgentTelemetry } from "../core/codex/session-telemetry";

const INITIAL_TAIL_BYTES = 16 * 1024 * 1024;

function dateDirectory(root: string, date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return join(root, year, month, day);
}

async function newestSessionFile(root: string, now = new Date()): Promise<string | undefined> {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const candidates: Array<{ path: string; modifiedAt: number }> = [];
  for (const directory of [dateDirectory(root, now), dateDirectory(root, yesterday)]) {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
          .map(async (entry) => {
            const path = join(directory, entry.name);
            const details = await stat(path);
            candidates.push({ path, modifiedAt: details.mtimeMs });
          }),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return candidates.sort((left, right) => right.modifiedAt - left.modifiedAt)[0]?.path;
}

async function readRange(path: string, start: number, end: number): Promise<string> {
  if (end <= start) return "";
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(end - start);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

export class CodexSessionMonitor {
  readonly #root: string;
  readonly #onTelemetry: (telemetry: AgentTelemetry) => void;
  readonly #onDiagnostic?: (code: string) => void;
  #timer?: ReturnType<typeof setInterval>;
  #path?: string;
  #offset = 0;
  #partial = "";
  #telemetry: AgentTelemetry | null = null;
  #published = "";
  #polling = false;
  #dropLeadingPartial = false;

  constructor(options: {
    sessionsRoot: string;
    onTelemetry(telemetry: AgentTelemetry): void;
    onDiagnostic?(code: string): void;
  }) {
    this.#root = options.sessionsRoot;
    this.#onTelemetry = options.onTelemetry;
    this.#onDiagnostic = options.onDiagnostic;
  }

  start(intervalMs = 1_000): void {
    if (this.#timer) return;
    void this.#poll();
    this.#timer = setInterval(() => void this.#poll(), intervalMs);
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  async #poll(): Promise<void> {
    if (this.#polling) return;
    this.#polling = true;
    try {
      const path = await newestSessionFile(this.#root);
      if (!path) return;
      const size = (await stat(path)).size;
      if (path !== this.#path || size < this.#offset) {
        this.#path = path;
        this.#offset = Math.max(0, size - INITIAL_TAIL_BYTES);
        this.#partial = "";
        this.#dropLeadingPartial = this.#offset > 0;
        this.#telemetry = null;
        this.#published = "";
      }
      if (size === this.#offset) return;
      let content = await readRange(path, this.#offset, size);
      if (this.#dropLeadingPartial) {
        const firstBreak = content.indexOf("\n");
        content = firstBreak >= 0 ? content.slice(firstBreak + 1) : "";
        this.#dropLeadingPartial = false;
      }
      this.#offset = size;
      const complete = `${this.#partial}${content}`;
      const lastBreak = complete.lastIndexOf("\n");
      if (lastBreak < 0) {
        this.#partial = complete;
        return;
      }
      this.#partial = complete.slice(lastBreak + 1);
      this.#telemetry = parseSessionTelemetry(complete.slice(0, lastBreak), this.#telemetry);
      if (!this.#telemetry) return;
      const serialized = JSON.stringify(this.#telemetry);
      if (serialized === this.#published) return;
      this.#published = serialized;
      this.#onTelemetry({ ...this.#telemetry });
    } catch {
      this.#onDiagnostic?.("codex-session-monitor-read-failed");
    } finally {
      this.#polling = false;
    }
  }
}
