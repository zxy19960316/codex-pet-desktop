import { formatResetCountdown } from "../../core/codex/usage-provider";
import type { DesktopSnapshot } from "../../shared/ipc-contract";
import { compactBucketLabel, selectCompactBuckets } from "./hud-view-model";

export function CompactHud({ snapshot }: { snapshot: DesktopSnapshot }) {
  const buckets = selectCompactBuckets(snapshot.rateLimits);
  return (
    <header className="compact-hud">
      <div className="compact-quotas" aria-label="Codex quota summary">
        {buckets.map((bucket, index) => (
          <div className="compact-quota" key={bucket?.id ?? `missing-${index}`}>
            <span className="compact-quota__label">{compactBucketLabel(bucket, index)}</span>
            <span className="compact-quota__track" aria-hidden="true">
              <span style={{ width: `${bucket?.remainingPercent ?? 0}%` }} />
            </span>
            <span className="compact-quota__value">
              {bucket ? `${Math.round(bucket.remainingPercent)}%` : "--"}
            </span>
            <span className="visually-hidden">
              {bucket ? `resets in ${formatResetCountdown(bucket.resetsAt)}` : "data unavailable"}
            </span>
          </div>
        ))}
      </div>
      <button
        className={`expand-control ${snapshot.settings.hudVisible ? "expand-control--open" : ""}`}
        onClick={() => void window.codexPet.toggleHud()}
        aria-label={snapshot.settings.hudVisible ? "Collapse details" : "Expand details"}
        aria-expanded={snapshot.settings.hudVisible}
      >
        <span aria-hidden="true" />
      </button>
    </header>
  );
}
