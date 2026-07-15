import type { PetState } from "../core/pet/pet-state";

export interface AnimationDefinition {
  frames: number;
  frameWidth: number;
  frameHeight: number;
  durationMs: number;
  loop?: boolean;
}

export interface AttributionEntry {
  name: string;
  license?: string;
  source?: string;
}

export interface PetManifest {
  id: string;
  displayName: string;
  spritesheetPath?: string;
  animations?: Partial<Record<PetState, AnimationDefinition>>;
  attribution?: AttributionEntry[];
}
