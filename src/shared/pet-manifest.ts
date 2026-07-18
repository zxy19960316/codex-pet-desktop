import type { PetState } from "../core/pet/pet-state";

export type {
  PetAnimationAsset,
  PetAnimationDefinition,
  PetAssetManifest,
  PetCapabilities,
  PetManifest,
  PetManifestValidationError,
  PetManifestValidationResult,
  PetMetadataValue,
  PetPackage,
  PetPackageIssue,
  PetPackageOrigin,
  PetRegistrySnapshot,
  PetSummary,
} from "../core/pet/pet-manifest";

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

/** @deprecated M3.0 compatibility type; use PetPackage for registry-backed pets. */
export interface RuntimePetTheme {
  id: string;
  displayName: string;
  animations: Partial<Record<PetState, AnimationDefinition>>;
  fallbacks: Partial<Record<PetState, PetState>>;
  attribution?: AttributionEntry[];
  imageUrl: string;
  sheetWidth: number;
  sheetHeight: number;
}
