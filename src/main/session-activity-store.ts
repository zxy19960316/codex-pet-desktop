import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface SessionActivityLedger {
  schemaVersion: 1;
  date: string;
  activeMs: number;
}

const MAX_ACTIVE_MS = 24 * 60 * 60_000;

export class SessionActivityStore {
  readonly #path: string;
  #ledger: SessionActivityLedger;

  constructor(path: string, date: string) {
    this.#path = path;
    this.#ledger = { schemaVersion: 1, date, activeMs: 0 };
  }

  get snapshot(): SessionActivityLedger {
    return { ...this.#ledger };
  }

  async load(date: string): Promise<SessionActivityLedger> {
    try {
      const value: unknown = JSON.parse(await readFile(this.#path, "utf8"));
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        (value as { schemaVersion?: unknown }).schemaVersion !== 1
      )
        return this.snapshot;
      const record = value as Partial<SessionActivityLedger>;
      if (
        record.date === date &&
        typeof record.activeMs === "number" &&
        Number.isFinite(record.activeMs)
      )
        this.#ledger = {
          schemaVersion: 1,
          date,
          activeMs: Math.max(0, Math.min(MAX_ACTIVE_MS, record.activeMs)),
        };
    } catch {
      /* corrupted or absent storage is intentionally empty */
    }
    return this.snapshot;
  }

  add(activeMs: number, date: string): void {
    if (date !== this.#ledger.date) this.#ledger = { schemaVersion: 1, date, activeMs: 0 };
    if (Number.isFinite(activeMs) && activeMs > 0)
      this.#ledger.activeMs = Math.min(MAX_ACTIVE_MS, this.#ledger.activeMs + activeMs);
  }

  async flush(): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true });
    const temporary = join(dirname(this.#path), `.${Date.now()}-session-activity.tmp`);
    await writeFile(temporary, JSON.stringify(this.#ledger) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, this.#path);
  }
}
