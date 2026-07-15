import type { DesktopSnapshot } from "../../shared/ipc-contract";
import { formatResetCountdown } from "../../core/codex/usage-provider";
import { formatTokenCount, rateLimitLabel } from "./hud-view-model";

export function Hud({ snapshot }: { snapshot: DesktopSnapshot }) {
  return (
    <section className="panel hud no-drag" aria-label="Codex usage HUD">
      <div className="panel-title">
        <span>Codex HUD</span>
        <button
          className="icon-button"
          onClick={() => void window.codexPet.toggleHud()}
          aria-label="Close HUD"
        >
          ×
        </button>
      </div>
      <dl className="metrics">
        <div>
          <dt>Connection</dt>
          <dd>{snapshot.connectionStatus}</dd>
        </div>
        <div>
          <dt>Pet state</dt>
          <dd>{snapshot.petState}</dd>
        </div>
        <div>
          <dt>Active threads</dt>
          <dd>{snapshot.activeThreadCount}</dd>
        </div>
        <div className="metric-wide">
          <dt>Project</dt>
          <dd title={snapshot.currentCwd}>{snapshot.currentCwd ?? "Unavailable"}</dd>
        </div>
      </dl>
      <div className="quota-list">
        {snapshot.rateLimits?.length ? (
          snapshot.rateLimits.map((bucket) => (
            <div className="quota" key={bucket.id}>
              <div className="quota-label">
                <span>{rateLimitLabel(bucket)}</span>
                <span>{Math.round(bucket.remainingPercent)}%</span>
              </div>
              <div className="quota-track">
                <span style={{ width: `${bucket.remainingPercent}%` }} />
              </div>
              <small>Resets in {formatResetCountdown(bucket.resetsAt)}</small>
            </div>
          ))
        ) : (
          <p className="unavailable">Quota data unavailable</p>
        )}
      </div>
      <div className="token-row">
        <span>Today</span>
        <strong>{formatTokenCount(snapshot.dailyUsage?.tokens)}</strong>
      </div>
      <div className="token-row">
        <span>Current thread</span>
        <strong>{formatTokenCount(snapshot.currentThreadTokens)}</strong>
      </div>
      {snapshot.connectionDetail && <p className="detail">{snapshot.connectionDetail}</p>}
    </section>
  );
}
