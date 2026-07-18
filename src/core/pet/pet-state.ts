export const PET_STATES = [
  "sleep",
  "idle",
  "thinking",
  "typing",
  "working",
  "approval",
  "waiting_input",
  "success",
  "error",
  "quota_low",
  "quota_empty",
  "offline",
] as const;

export type PetState = (typeof PET_STATES)[number];

export interface PetStateChange {
  threadId: string;
  turnId?: string;
  state: PetState;
  source: string;
  timestamp: number;
  summary?: string;
  transientReturnState?: PetState;
}

export function isPetState(value: unknown): value is PetState {
  return typeof value === "string" && PET_STATES.includes(value as PetState);
}
