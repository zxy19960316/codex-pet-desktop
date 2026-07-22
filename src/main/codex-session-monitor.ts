import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseSessionTelemetry, type AgentTelemetry } from "../core/codex/session-telemetry";

export const MAX_MONITORED_SESSION_FILES = 10;
const INITIAL_TAIL_BYTES = 512 * 1024;
const MAX_PARTIAL_BYTES = 64 * 1024;

interface SessionFile {
  path: string;
  modifiedAt: number;
}

interface FileCursor {
  offset: number;
  partial: string;
  telemetry: AgentTelemetry | null;
  published: string;
  dropLeadingPartial: boolean;
}

function dateDirectory(root: string, date: Date): string {
  return join(
    root,
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  );
}

export async function recentSessionFiles(
  root: string,
  now = new Date(),
  maximum = MAX_MONITORED_SESSION_FILES,
): Promise<SessionFile[]> {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const candidates: SessionFile[] = [];
  for (const directory of [dateDirectory(root, now), dateDirectory(root, yesterday)]) {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      const files = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
          .map(async (entry) => {
            const path = join(directory, entry.name);
            return { path, modifiedAt: (await stat(path)).mtimeMs };
          }),
      );
      candidates.push(...files);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return candidates
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
    .slice(0, Math.max(1, maximum));
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
  readonly #cursors = new Map<string, FileCursor>();
  #timer?: ReturnType<typeof setInterval>;
  #polling = false;

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
    this.#cursors.clear();
  }

  async #poll(): Promise<void> {
    if (this.#polling) return;
    this.#polling = true;
    try {
      const files = await recentSessionFiles(this.#root);
      const livePaths = new Set(files.map((file) => file.path));
      for (const path of this.#cursors.keys()) if (!livePaths.has(path)) this.#cursors.delete(path);
      for (const file of files) await this.#readFile(file.path);
    } catch {
      this.#onDiagnostic?.("codex-session-monitor-read-failed");
    } finally {
      this.#polling = false;
    }
  }

  async #readFile(path: string): Promise<void> {
    const size = (await stat(path)).size;
    let cursor = this.#cursors.get(path);
    if (!cursor || size < cursor.offset) {
      cursor = {
        offset: Math.max(0, size - INITIAL_TAIL_BYTES),
        partial: "",
        telemetry: null,
        published: "",
        dropLeadingPartial: size > INITIAL_TAIL_BYTES,
      };
      this.#cursors.set(path, cursor);
    }
    if (size === cursor.offset) return;
    let content = await readRange(path, cursor.offset, size);
    cursor.offset = size;
    if (cursor.dropLeadingPartial) {
      const firstBreak = content.indexOf("\n");
      content = firstBreak >= 0 ? content.slice(firstBreak + 1) : "";
      cursor.dropLeadingPartial = false;
    }
    const complete = `${cursor.partial}${content}`;
    const lastBreak = complete.lastIndexOf("\n");
    if (lastBreak < 0) {
      cursor.partial = complete.slice(-MAX_PARTIAL_BYTES);
      return;
    }
    cursor.partial = complete.slice(lastBreak + 1).slice(-MAX_PARTIAL_BYTES);
    cursor.telemetry = parseSessionTelemetry(complete.slice(0, lastBreak), cursor.telemetry);
    if (!cursor.telemetry) return;
    const serialized = JSON.stringify(cursor.telemetry);
    if (serialized === cursor.published) return;
    cursor.published = serialized;
    this.#onTelemetry({ ...cursor.telemetry });
  }
}
