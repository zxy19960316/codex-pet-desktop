import type { PetState } from "./pet-state";

export const PET_STATE_PRIORITY: Readonly<Record<PetState, number>> = {
  sleeping: 0,
  idle: 1,
  quota_low: 2,
  thinking: 3,
  typing: 4,
  working: 5,
  success: 6,
  quota_exhausted: 7,
  waiting_input: 8,
  approval: 9,
  error: 10,
};

export function highestPriority(states: Iterable<PetState>): PetState {
  let highest: PetState = "sleeping";
  for (const state of states) {
    if (PET_STATE_PRIORITY[state] > PET_STATE_PRIORITY[highest]) highest = state;
  }
  return highest;
}
