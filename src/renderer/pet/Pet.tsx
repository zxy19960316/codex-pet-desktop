import type { CSSProperties } from "react";
import type { PetState } from "../../core/pet/pet-state";
import type { PetPackage } from "../../core/pet/pet-manifest";
import { computePetVisualMetrics } from "../../core/pet/pet-display";
import { resolvePetAnimation, spriteStyle } from "./pet-animation";
import { PetStateOverlay } from "./PetStateOverlay";

const STATE_LABELS: Record<PetState, string> = {
  sleep: "Sleeping",
  idle: "Ready",
  thinking: "Thinking",
  typing: "Editing",
  working: "Working",
  approval: "Needs approval",
  waiting_input: "Waiting for you",
  success: "Done",
  error: "Something went wrong",
  quota_low: "Quota is low",
  quota_empty: "Quota exhausted",
  offline: "Offline",
};

export function Pet({
  state,
  pet,
  scalePercent = 100,
  physicalScaleFactor = 1,
}: {
  state: PetState;
  pet?: PetPackage;
  scalePercent?: number;
  physicalScaleFactor?: number;
}) {
  const resolved = pet ? resolvePetAnimation(pet, state) : undefined;
  const metrics = computePetVisualMetrics(
    resolved?.animation.frameWidth ?? 64,
    resolved?.animation.frameHeight ?? 64,
    scalePercent,
    physicalScaleFactor,
  );
  const style = resolved
    ? ({
        ...spriteStyle(resolved.animation),
        transform: `scale(${metrics.scale})`,
      } as CSSProperties)
    : undefined;
  return (
    <section
      className="pet-stage"
      aria-label={`Pet state: ${STATE_LABELS[state]}`}
      style={{
        width: Math.max(240, metrics.width + 24),
        minHeight: Math.max(230, metrics.height + 38),
      }}
    >
      <div className="pet-shadow" style={{ width: Math.max(72, metrics.width * 0.62) }} />
      <div
        className="pet-sprite"
        data-pet-state={state}
        data-animation-state={resolved?.resolvedState ?? "unavailable"}
        style={style}
        aria-hidden="true"
      />
      <PetStateOverlay state={state} />
      <span className="visually-hidden">{STATE_LABELS[state]}</span>
    </section>
  );
}
