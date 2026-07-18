import type { PetState } from "./pet-state";

export const PET_STATE_PRIORITY: Readonly<Record<PetState, number>> = {
  sleep: 0,
  idle: 1,
  quota_low: 2,
  offline: 3,
  thinking: 4,
  typing: 5,
  working: 6,
  success: 7,
  quota_empty: 8,
  waiting_input: 9,
  approval: 10,
  error: 11,
};

export function highestPriority(states: Iterable<PetState>): PetState {
  let highest: PetState = "sleep";
  for (const state of states) {
    if (PET_STATE_PRIORITY[state] > PET_STATE_PRIORITY[highest]) highest = state;
  }
  return highest;
}
