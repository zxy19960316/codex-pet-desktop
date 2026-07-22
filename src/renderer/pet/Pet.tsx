import { useRef, type CSSProperties, type ReactNode } from "react";
import type { PetState } from "../../core/pet/pet-state";
import type { PetPackage } from "../../core/pet/pet-manifest";
import { computePetVisualMetrics } from "../../core/pet/pet-display";
import { resolvePetAnimation, spriteStyle } from "./pet-animation";
import { useWindowShapeReporter } from "./window-shape-reporter";

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
  resourceHud,
}: {
  state: PetState;
  pet?: PetPackage;
  scalePercent?: number;
  physicalScaleFactor?: number;
  resourceHud?: ReactNode;
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
        transform: `translate(-50%, -50%) scale(${metrics.scale})`,
      } as CSSProperties)
    : undefined;
  const spriteRef = useRef<HTMLDivElement>(null);
  useWindowShapeReporter(spriteRef, resolved?.animation);
  return (
    <section
      className="pet-stage"
      aria-label={`Pet state: ${STATE_LABELS[state]}`}
      style={
        {
          width: Math.max(136, metrics.width + 24),
          minHeight: Math.max(196, metrics.height + 100),
          "--pet-hud-width": `${Math.max(112, metrics.width + 8)}px`,
        } as CSSProperties
      }
    >
      {resourceHud}
      <div
        className="pet-sprite-slot"
        style={{ width: metrics.width, height: metrics.height }}
        aria-hidden="true"
      >
        <div className="pet-shadow" style={{ width: Math.max(72, metrics.width * 0.62) }} />
        <div
          ref={spriteRef}
          className="pet-sprite"
          data-pet-state={state}
          data-animation-state={resolved?.resolvedState ?? "unavailable"}
          style={style}
        />
      </div>
      <span className="visually-hidden">{STATE_LABELS[state]}</span>
    </section>
  );
}
