import type { PetManifest } from "./pet-manifest";

/**
 * Format-neutral extension point for future external sprite projects.
 * Adapters convert only user-selected, locally available sources into the
 * canonical Pet Package layout; the registry never downloads third-party art.
 */
export interface ExternalPetAdapter<TSource = unknown> {
  readonly id: string;
  canAdapt(source: TSource): boolean | Promise<boolean>;
  adapt(source: TSource, destination: string): Promise<PetManifest>;
}
