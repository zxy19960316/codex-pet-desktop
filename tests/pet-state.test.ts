import { afterEach, describe, expect, it, vi } from "vitest";
import { PET_STATE_PRIORITY } from "../src/core/pet/state-priority";
import { PetStateMachine } from "../src/core/pet/state-machine";
import type { PetState, PetStateChange } from "../src/core/pet/pet-state";

const order: PetState[] = [
  "error",
  "approval",
  "waiting_input",
  "quota_exhausted",
  "success",
  "working",
  "typing",
  "thinking",
  "quota_low",
  "idle",
  "sleeping",
];

function change(threadId: string, state: PetState, timestamp = 1): PetStateChange {
  return { threadId, state, source: "test", timestamp };
}

afterEach(() => vi.useRealTimers());

describe("pet state", () => {
  it("uses the required priority order", () => {
    expect([...order].sort((a, b) => PET_STATE_PRIORITY[b] - PET_STATE_PRIORITY[a])).toEqual(order);
  });

  it("stores state independently and aggregates the highest active priority", () => {
    const machine = new PetStateMachine();
    machine.update(change("thread-a", "thinking"));
    machine.update(change("thread-b", "approval"));
    expect(machine.getThreadState("thread-a")?.state).toBe("thinking");
    expect(machine.getThreadState("thread-b")?.state).toBe("approval");
    expect(machine.getGlobalState()).toBe("approval");
    expect(machine.getActiveThreadCount()).toBe(2);
  });

  it("restores transient success and error to the prior stable state", async () => {
    vi.useFakeTimers();
    const machine = new PetStateMachine({ transientDurationMs: 100 });
    machine.update(change("thread-a", "working"));
    machine.update(change("thread-a", "success", 2));
    expect(machine.getGlobalState()).toBe("success");
    await vi.advanceTimersByTimeAsync(101);
    expect(machine.getThreadState("thread-a")?.state).toBe("working");
  });
});
