import type { PetAnimationAsset, PetPackage } from "./pet-manifest";
import type { PetState } from "./pet-state";

export const DEFAULT_ANIMATION_FALLBACKS: Readonly<Record<PetState, readonly PetState[]>> = {
  idle: [],
  thinking: ["idle"],
  typing: ["working", "thinking", "idle"],
  working: ["thinking", "idle"],
  approval: ["thinking", "idle"],
  waiting_input: ["thinking", "idle"],
  success: ["idle"],
  error: ["thinking", "idle"],
  quota_low: ["idle"],
  quota_empty: ["sleep", "idle"],
  offline: ["sleep", "idle"],
  sleep: ["idle"],
};

export interface ResolvedPetAnimation {
  requestedState: PetState;
  resolvedState: PetState;
  animation: PetAnimationAsset;
  fallbackPath: PetState[];
}

function nextFallback(
  pet: PetPackage,
  state: PetState,
  fallbackIndex: number,
): PetState | undefined {
  const explicit = pet.manifest.fallbacks?.[state];
  if (explicit) return explicit;
  return DEFAULT_ANIMATION_FALLBACKS[state][fallbackIndex];
}

export class AnimationResolver {
  resolve(pet: PetPackage, requestedState: PetState): ResolvedPetAnimation | undefined {
    const visited = new Set<PetState>();
    const fallbackPath: PetState[] = [];
    let state: PetState | undefined = requestedState;
    let fallbackIndex = 0;

    while (state && !visited.has(state)) {
      visited.add(state);
      fallbackPath.push(state);
      const animation = pet.animations[state];
      if (animation) return { requestedState, resolvedState: state, animation, fallbackPath };

      const next = nextFallback(pet, state, fallbackIndex);
      if (next) {
        state = next;
        fallbackIndex = 0;
        continue;
      }

      const requestedChain = DEFAULT_ANIMATION_FALLBACKS[requestedState];
      fallbackIndex += 1;
      state = requestedChain[fallbackIndex] ?? (state === "idle" ? undefined : "idle");
    }

    const idle = pet.animations.idle;
    if (!idle) return undefined;
    if (!fallbackPath.includes("idle")) fallbackPath.push("idle");
    return { requestedState, resolvedState: "idle", animation: idle, fallbackPath };
  }
}

const resolver = new AnimationResolver();

export function resolvePetAnimation(
  pet: PetPackage,
  requestedState: PetState,
): ResolvedPetAnimation | undefined {
  return resolver.resolve(pet, requestedState);
}
