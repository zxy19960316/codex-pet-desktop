import type { PetStateChange } from "../pet/pet-state";
import type { SessionSnapshot } from "./session-types";

export class SessionRegistry {
  readonly #sessions = new Map<string, SessionSnapshot>();

  upsert(threadId: string, patch: Partial<Omit<SessionSnapshot, "threadId">>): SessionSnapshot {
    const current = this.#sessions.get(threadId);
    const next: SessionSnapshot = {
      threadId,
      updatedAt: Date.now(),
      ...current,
      ...patch,
    };
    this.#sessions.set(threadId, next);
    return { ...next };
  }

  updateState(change: PetStateChange): SessionSnapshot {
    return this.upsert(change.threadId, { state: change, updatedAt: change.timestamp });
  }

  list(): SessionSnapshot[] {
    return [...this.#sessions.values()].map((session) => ({ ...session }));
  }
}
