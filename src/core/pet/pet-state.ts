export const PET_STATES = [
  "sleeping",
  "idle",
  "thinking",
  "typing",
  "working",
  "approval",
  "waiting_input",
  "success",
  "error",
  "quota_low",
  "quota_exhausted",
] as const;

export type PetState = (typeof PET_STATES)[number];

export interface PetStateChange {
  threadId: string;
  turnId?: string;
  state: PetState;
  source: string;
  timestamp: number;
  summary?: string;
}

export function isPetState(value: unknown): value is PetState {
  return typeof value === "string" && PET_STATES.includes(value as PetState);
}
