import type { PetState } from "../core/pet/pet-state";

export interface AnimationDefinition {
  row: number;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  durationMs: number;
  loop: boolean;
}

export interface AttributionEntry {
  name: string;
  license?: string;
  source?: string;
}

export interface PetManifest {
  id: string;
  displayName: string;
  animations: Partial<Record<PetState, AnimationDefinition>>;
  fallbacks: Partial<Record<PetState, PetState>>;
  attribution?: AttributionEntry[];
}

export interface RuntimePetTheme extends PetManifest {
  imageUrl: string;
  sheetWidth: number;
  sheetHeight: number;
}
