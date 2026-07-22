import type { RateLimitBucket } from "../../core/codex/usage-provider";
import { buildBattleHudViewModel } from "../hud/hud-view-model";

export function PetResourceBars({
  buckets,
  model,
  reasoningEffort,
  currentTokens,
  contextWindowTokens,
  expanded,
  onToggle,
}: {
  buckets: RateLimitBucket[] | null;
  model?: string | null;
  reasoningEffort?: string | null;
  currentTokens?: number | null;
  contextWindowTokens?: number | null;
  expanded: boolean;
  onToggle(): void;
}) {
  const hud = buildBattleHudViewModel({
    buckets,
    model,
    reasoningEffort,
    currentTokens,
    contextWindowTokens,
  });
  return (
    <div className="pet-resources" aria-label="Codex Agent battle status">
      <div className="pet-resources__header">
        <strong title={hud.model}>{hud.model}</strong>
        <span title={`Reasoning effort: ${hud.reasoningEffort}`}>{hud.reasoningEffort}</span>
      </div>
      <div className="pet-resources__bars">
        {hud.bars.map((bar) => (
          <div className={`pet-resource pet-resource--${bar.kind}`} key={bar.kind}>
            <span className="pet-resource__label">{bar.label}</span>
            <span
              className="pet-resource__track"
              role="meter"
              aria-label={`${bar.label} quota remaining`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={bar.value}
            >
              <span style={{ width: `${bar.value}%` }} />
            </span>
          </div>
        ))}
      </div>
      <div className="pet-resources__footer" aria-label="Current session tokens and context window">
        {hud.tokens}
      </div>
      <button
        type="button"
        className={`pet-resources__toggle ${expanded ? "pet-resources__toggle--open" : ""}`}
        onClick={onToggle}
        aria-label={expanded ? "Collapse details" : "Expand details"}
        aria-expanded={expanded}
      >
        <span aria-hidden="true">⌄</span>
      </button>
    </div>
  );
}
