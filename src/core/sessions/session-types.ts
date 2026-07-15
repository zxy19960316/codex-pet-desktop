import type { PetStateChange } from "../pet/pet-state";

export interface SessionSnapshot {
  threadId: string;
  cwd?: string;
  title?: string;
  state?: PetStateChange;
  currentTokens?: number;
  updatedAt: number;
}
