import type { PetState } from "../../core/pet/pet-state";

const STATE_LABELS: Record<PetState, string> = {
  sleeping: "Sleeping",
  idle: "Ready",
  thinking: "Thinking",
  typing: "Editing",
  working: "Working",
  approval: "Needs approval",
  waiting_input: "Waiting for you",
  success: "Done",
  error: "Something went wrong",
  quota_low: "Quota is low",
  quota_exhausted: "Quota exhausted",
};

export function Pet({ state }: { state: PetState }) {
  return (
    <section className="pet-stage" aria-label={`Pet state: ${STATE_LABELS[state]}`}>
      <div className="pet-shadow" />
      <div className="pet" data-pet-state={state}>
        <div className="pet-ear pet-ear--left" />
        <div className="pet-ear pet-ear--right" />
        <div className="pet-face">
          <span className="pet-eye pet-eye--left" />
          <span className="pet-eye pet-eye--right" />
          <span className="pet-mouth" />
        </div>
        <div className="pet-spark">✦</div>
      </div>
      <div className="state-pill">{STATE_LABELS[state]}</div>
    </section>
  );
}
