import { PET_STATES, type PetState } from "../../core/pet/pet-state";
import type { AnimationDefinition, RuntimePetTheme } from "../../shared/pet-manifest";

export interface ResolvedPetAnimation {
  state: PetState;
  animation: AnimationDefinition;
}

export function resolvePetAnimation(
  theme: RuntimePetTheme,
  requestedState: PetState,
): ResolvedPetAnimation {
  const visited = new Set<PetState>();
  let state: PetState = requestedState;
  while (visited.size <= PET_STATES.length) {
    const animation = theme.animations[state];
    if (animation) return { state, animation };
    if (visited.has(state)) break;
    visited.add(state);
    state = theme.fallbacks[state] ?? "idle";
  }
  const idle = theme.animations.idle;
  if (!idle) throw new Error("Pet theme must define an idle animation");
  return { state: "idle", animation: idle };
}

export function spriteStyle(theme: RuntimePetTheme, animation: AnimationDefinition) {
  return {
    width: `${animation.frameWidth}px`,
    height: `${animation.frameHeight}px`,
    backgroundImage: `url("${theme.imageUrl}")`,
    backgroundSize: `${theme.sheetWidth}px ${theme.sheetHeight}px`,
    backgroundPositionY: `${-animation.row * animation.frameHeight}px`,
    "--pet-frame-distance": `${-animation.frames * animation.frameWidth}px`,
    "--pet-frames": String(animation.frames),
    "--pet-duration": `${animation.durationMs}ms`,
    "--pet-iteration": animation.loop ? "infinite" : "1",
  };
}
