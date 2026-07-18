import { clampPetScale } from "../../shared/settings";

export const PET_BASE_VISUAL_HEIGHT = 192;

export interface PetVisualMetrics {
  scale: number;
  width: number;
  height: number;
}

export function computePetVisualMetrics(
  frameWidth: number,
  frameHeight: number,
  scalePercent: number,
  physicalScaleFactor = 1,
): PetVisualMetrics {
  const safeWidth = Number.isFinite(frameWidth) && frameWidth > 0 ? frameWidth : 64;
  const safeHeight = Number.isFinite(frameHeight) && frameHeight > 0 ? frameHeight : 64;
  const safePhysicalFactor =
    Number.isFinite(physicalScaleFactor) && physicalScaleFactor > 0
      ? Math.min(4, Math.max(0.25, physicalScaleFactor))
      : 1;
  const scale =
    (PET_BASE_VISUAL_HEIGHT / safeHeight) *
    (clampPetScale(scalePercent) / 100) *
    safePhysicalFactor;
  return {
    scale,
    width: Math.max(1, Math.ceil(safeWidth * scale)),
    height: Math.max(1, Math.ceil(safeHeight * scale)),
  };
}
