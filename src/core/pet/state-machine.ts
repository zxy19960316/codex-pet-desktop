import type { PetState, PetStateChange } from "./pet-state";
import { highestPriority } from "./state-priority";

interface ThreadRecord {
  change: PetStateChange;
  priorStable: PetState;
  timer?: ReturnType<typeof setTimeout>;
}

export interface PetStateMachineOptions {
  transientDurationMs?: number;
  onChange?: (globalState: PetState, change: PetStateChange) => void;
}

export class PetStateMachine {
  readonly #threads = new Map<string, ThreadRecord>();
  readonly #transientDurationMs: number;
  readonly #onChange?: (globalState: PetState, change: PetStateChange) => void;

  constructor(options: PetStateMachineOptions = {}) {
    this.#transientDurationMs = options.transientDurationMs ?? 3_000;
    this.#onChange = options.onChange;
  }

  update(change: PetStateChange): PetState {
    const existing = this.#threads.get(change.threadId);
    if (existing?.timer) clearTimeout(existing.timer);
    const transient = change.state === "success" || change.state === "error";
    const priorStable = transient
      ? (change.transientReturnState ??
        (existing?.change.state === "success" || existing?.change.state === "error"
          ? existing.priorStable
          : (existing?.change.state ?? "idle")))
      : change.state;
    const record: ThreadRecord = { change: { ...change }, priorStable };
    this.#threads.set(change.threadId, record);
    if (transient) {
      record.timer = setTimeout(() => {
        const current = this.#threads.get(change.threadId);
        if (current !== record) return;
        const restored: PetStateChange = {
          ...change,
          state: record.priorStable,
          source: "transient-restore",
          timestamp: Date.now(),
          summary: undefined,
          transientReturnState: undefined,
        };
        this.#threads.set(change.threadId, { change: restored, priorStable: restored.state });
        this.#onChange?.(this.getGlobalState(), restored);
      }, this.#transientDurationMs);
    }
    const globalState = this.getGlobalState();
    this.#onChange?.(globalState, change);
    return globalState;
  }

  getThreadState(threadId: string): PetStateChange | undefined {
    const change = this.#threads.get(threadId)?.change;
    return change ? { ...change } : undefined;
  }

  remove(threadId: string): void {
    const record = this.#threads.get(threadId);
    if (!record) return;
    if (record.timer) clearTimeout(record.timer);
    this.#threads.delete(threadId);
    this.#onChange?.(this.getGlobalState(), {
      threadId,
      state: "idle",
      source: "thread-removed",
      timestamp: Date.now(),
    });
  }

  getGlobalState(): PetState {
    return highestPriority([...this.#threads.values()].map(({ change }) => change.state));
  }

  getActiveThreadCount(): number {
    return [...this.#threads.values()].filter(
      ({ change }) => !["idle", "sleeping"].includes(change.state),
    ).length;
  }

  snapshot(): PetStateChange[] {
    return [...this.#threads.values()].map(({ change }) => ({ ...change }));
  }

  dispose(): void {
    for (const record of this.#threads.values()) if (record.timer) clearTimeout(record.timer);
    this.#threads.clear();
  }
}
