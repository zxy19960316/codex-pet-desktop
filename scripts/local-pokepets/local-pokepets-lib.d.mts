export const ALLOWED_PETS: readonly ["pikachu", "charizard", "mew"];
export const REQUIRED_STATES: readonly [
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
  "sleep",
];
export interface ImageMetadata {
  format: "webp" | "gif" | "png";
  width: number;
  height: number;
}
export interface SourceValidation {
  id: string;
  displayName: string;
  atlas: ImageMetadata;
  preview: ImageMetadata;
  frameWidth: 192;
  frameHeight: 208;
  columns: 8;
  rows: 9;
}
export interface DerivedValidation {
  id: string;
  name: string;
  stateCount: 12;
  animations: Record<string, { sprite: string; frames: number; fps: number }>;
}
export function assertAllowedPet(value: string): "pikachu" | "charizard" | "mew";
export function assertInsideRoot(root: string, candidate: string): string;
export function readImageMetadata(path: string): Promise<ImageMetadata>;
export function validateSourcePetDirectory(
  directory: string,
  expectedId: string,
): Promise<SourceValidation>;
export function validateDerivedPetDirectory(directory: string): Promise<DerivedValidation>;
