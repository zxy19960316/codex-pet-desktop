import type { CSSProperties } from "react";
import type { PetState } from "../../core/pet/pet-state";
import { BUILTIN_PIXEL_PET } from "./builtin-theme";
import { resolvePetAnimation, spriteStyle } from "./pet-animation";

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

export function Pet({ state }: { state: PetState }) {
  const resolved = resolvePetAnimation(BUILTIN_PIXEL_PET, state);
  const style = resolved ? (spriteStyle(resolved.animation) as CSSProperties) : undefined;
  return (
    <section className="pet-stage" aria-label={`Pet state: ${STATE_LABELS[state]}`}>
      <div className="pet-shadow" />
      <div
        className="pet-sprite"
        data-pet-state={state}
        data-animation-state={resolved?.resolvedState ?? "unavailable"}
        style={style}
        aria-hidden="true"
      />
      <span className="visually-hidden">{STATE_LABELS[state]}</span>
    </section>
  );
}
