import type { PetManifest } from "../pet-manifest";

export interface CodexPokePetJson {
  id: string;
  displayName: string;
  description?: string;
  spritesheetPath: string;
}

export interface CodexPokePetSource {
  sourcePetId: string;
  displayName: string;
  description?: string;
  sourceDirectory: string;
  spritesheetPath: string;
}

export interface CodexPokePetDiscovery {
  sourcePetId: string;
  displayName: string;
  compatible: boolean;
  imported: boolean;
  thirdParty: true;
  error?: string;
}

export interface CodexPokePetsDiscoverySnapshot {
  rootAvailable: boolean;
  pets: CodexPokePetDiscovery[];
}

export interface AdaptedCodexPokePet {
  manifest: PetManifest;
  source: CodexPokePetSource;
}
