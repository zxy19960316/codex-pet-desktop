export { resolvePetAnimation } from "../../core/pet/animation-resolver";
import type { PetAnimationAsset } from "../../core/pet/pet-manifest";

export function spriteStyle(animation: PetAnimationAsset) {
  const durationMs = Math.max(1, Math.round((animation.frames / animation.fps) * 1_000));
  return {
    width: `${animation.frameWidth}px`,
    height: `${animation.frameHeight}px`,
    backgroundImage: `url("${animation.spriteUrl}")`,
    backgroundSize: `${animation.sheetWidth}px ${animation.sheetHeight}px`,
    backgroundPositionY: `${-(animation.frameRow ?? 0) * animation.frameHeight}px`,
    "--pet-frame-distance": `${-animation.frames * animation.frameWidth}px`,
    "--pet-frames": String(animation.frames),
    "--pet-duration": `${durationMs}ms`,
    "--pet-iteration": animation.loop ? "infinite" : "1",
  };
}
