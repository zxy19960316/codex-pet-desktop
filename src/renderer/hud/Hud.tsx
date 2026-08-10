import type { DesktopSnapshot } from "../../shared/ipc-contract";
import { formatResetCountdown } from "../../core/codex/usage-provider";
import type { PetState } from "../../core/pet/pet-state";
import { connectionStatusLabel, protocolSourceLabel } from "../settings/settings-copy";
import { buildSessionPresentation } from "../sessions/session-view-model";
import { formatTokenCount } from "./hud-view-model";

const PET_STATE_LABELS: Readonly<Record<PetState, string>> = {
  sleep: "睡眠",
  idle: "待机",
  thinking: "思考中",
  typing: "输入中",
  working: "工作中",
  approval: "等待确认",
  waiting_input: "等待输入",
  success: "已完成",
  error: "出错",
  quota_low: "额度偏低",
  quota_empty: "额度耗尽",
  offline: "离线",
};

function tokenLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? "不可用" : formatTokenCount(value);
}

function quotaLabel(label: string | undefined, windowDurationMins: number): string {
  if (label) return label;
  if (windowDurationMins === 10_080) return "每周窗口";
  if (windowDurationMins % 60 === 0) return `${windowDurationMins / 60} 小时窗口`;
  return `${windowDurationMins} 分钟窗口`;
}

export function Hud({ snapshot }: { snapshot: DesktopSnapshot }) {
  const sessions = buildSessionPresentation(snapshot, 6);
  return (
    <section className="panel hud session-hub no-drag" aria-label="会话 Hub">
      <div className="panel-title session-hub__title">
        <span>会话 Hub</span>
        <small>
          共 {sessions.totalCount} · 活跃 {sessions.activeCount}
        </small>
      </div>

      <div className="session-hub__actions">
        <button type="button" onClick={() => void window.codexPet.openSettings()}>
          打开设置中心
        </button>
        <button type="button" onClick={() => void window.codexPet.toggleHud()}>
          关闭
        </button>
      </div>

      <dl className="metrics session-hub__metrics">
        <div>
          <dt>连接状态</dt>
          <dd>{connectionStatusLabel(snapshot.connectionStatus)}</dd>
        </div>
        <div>
          <dt>宠物状态</dt>
          <dd>{PET_STATE_LABELS[snapshot.petState]}</dd>
        </div>
        <div>
          <dt>观测来源</dt>
          <dd>{protocolSourceLabel(snapshot.protocolSource)}</dd>
        </div>
        <div>
          <dt>今日活跃</dt>
          <dd>{sessions.todayActiveLabel}</dd>
        </div>
      </dl>

      <section className="session-hub__sessions" aria-labelledby="session-hub-list-title">
        <div className="session-hub__section-heading">
          <strong id="session-hub-list-title">会话详情</strong>
          <small>最多显示 6 个最近会话</small>
        </div>
        {sessions.items.length ? (
          <div className="session-hub__list">
            {sessions.items.map((session) => (
              <article
                className="session-hub__session"
                data-session-state={session.state}
                key={session.sessionId}
              >
                <header>
                  <strong title={session.title}>{session.title}</strong>
                  <span>{session.stateLabel}</span>
                </header>
                <p>{session.projectLabel ?? "未提供项目标签"}</p>
                <div className="session-hub__session-meta">
                  <span>已工作 {session.activeWorkLabel}</span>
                  <span>总时长 {session.elapsedLabel}</span>
                  {session.turnElapsedLabel ? <span>本轮 {session.turnElapsedLabel}</span> : null}
                </div>
                <div className="session-hub__session-footer">
                  <small>{session.requiresAttention ? "需要你的处理" : "无需立即处理"}</small>
                  <button
                    type="button"
                    disabled={!session.canSelect}
                    onClick={() => void window.codexPet.selectThread(session.sessionId)}
                  >
                    {session.canSelect ? "选择会话" : "仅供查看"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="unavailable">暂无可显示的会话详情。</p>
        )}
      </section>

      <section className="session-hub__usage" aria-label="额度与用量">
        <div className="session-hub__section-heading">
          <strong>额度与用量</strong>
          <small>当前会话 {tokenLabel(snapshot.currentThreadTokens)} Token</small>
        </div>
        <div className="quota-list">
          {snapshot.rateLimits?.length ? (
            snapshot.rateLimits.map((bucket) => (
              <div className="quota" key={bucket.id}>
                <div className="quota-label">
                  <span>{quotaLabel(bucket.label, bucket.windowDurationMins)}</span>
                  <span>剩余 {Math.round(bucket.remainingPercent)}%</span>
                </div>
                <div className="quota-track">
                  <span style={{ width: `${bucket.remainingPercent}%` }} />
                </div>
                <small>{formatResetCountdown(bucket.resetsAt)} 后重置</small>
              </div>
            ))
          ) : (
            <p className="unavailable">暂时没有可用的额度数据。</p>
          )}
        </div>
        <div className="token-row">
          <span>今日 Token</span>
          <strong>{tokenLabel(snapshot.dailyUsage?.tokens)}</strong>
        </div>
      </section>

      {snapshot.connectionDetail ? <p className="detail">{snapshot.connectionDetail}</p> : null}
    </section>
  );
}
