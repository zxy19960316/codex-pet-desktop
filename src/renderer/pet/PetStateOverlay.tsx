import type { PetState } from "../../core/pet/pet-state";

const OVERLAY_CONTENT: Record<PetState, { symbol: string; label: string }> = {
  idle: { symbol: "·", label: "Ready" },
  thinking: { symbol: "?", label: "Thinking" },
  typing: { symbol: "•••", label: "Typing" },
  working: { symbol: "◌", label: "Working" },
  approval: { symbol: "!", label: "Needs approval" },
  waiting_input: { symbol: "…", label: "Waiting for input" },
  success: { symbol: "✦", label: "Success" },
  error: { symbol: "×", label: "Error" },
  quota_low: { symbol: "▂", label: "Quota low" },
  quota_empty: { symbol: "▱", label: "Quota empty" },
  offline: { symbol: "⌁", label: "Offline" },
  sleep: { symbol: "Z", label: "Sleeping" },
};

export function PetStateOverlay({ state }: { state: PetState }) {
  const content = OVERLAY_CONTENT[state];
  return (
    <div
      className={`pet-state-overlay pet-state-overlay--${state}`}
      data-overlay-state={state}
      aria-label={content.label}
    >
      <span aria-hidden="true">{content.symbol}</span>
    </div>
  );
}
