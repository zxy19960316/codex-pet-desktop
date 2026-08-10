import { ACTIVE_SESSION_STATES, type AgentSessionState } from "../../core/sessions/session-types";
import type { DesktopSessionSummary, DesktopSnapshot } from "../../shared/ipc-contract";

const SESSION_STATE_LABELS: Readonly<Record<AgentSessionState, string>> = {
  idle: "待机",
  thinking: "思考中",
  working: "工作中",
  approval: "等待确认",
  waiting_input: "等待输入",
  success: "已完成",
  error: "出错",
  interrupted: "已中断",
  offline: "离线",
  closed: "已关闭",
};

export interface SessionPresentationItem {
  sessionId: string;
  title: string;
  shortTitle: string;
  projectLabel?: string;
  state: AgentSessionState;
  stateLabel: string;
  activeWorkLabel: string;
  elapsedLabel: string;
  turnElapsedLabel?: string;
  requiresAttention: boolean;
  canSelect: boolean;
}

export interface SessionPresentation {
  totalCount: number;
  activeCount: number;
  todayActiveLabel: string;
  items: SessionPresentationItem[];
}

function boundedText(value: string, maximum: number, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? [...normalized].slice(0, maximum).join("") : fallback;
}

export function sessionStateLabel(state: AgentSessionState): string {
  return SESSION_STATE_LABELS[state];
}

export function formatSessionDuration(milliseconds: number): string {
  const safe = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  const minutes = Math.floor(safe / 60_000);
  if (minutes < 1) return "<1 分钟";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}

function toPresentationItem(session: DesktopSessionSummary): SessionPresentationItem {
  const title = boundedText(session.title, 36, "未命名会话");
  const projectLabel = session.projectLabel
    ? boundedText(session.projectLabel, 28, "") || undefined
    : undefined;
  return {
    sessionId: session.sessionId,
    title,
    shortTitle: boundedText(title, 22, "未命名会话"),
    projectLabel,
    state: session.state,
    stateLabel: sessionStateLabel(session.state),
    activeWorkLabel: formatSessionDuration(session.activeWorkMs),
    elapsedLabel: formatSessionDuration(session.sessionElapsedMs),
    turnElapsedLabel:
      session.turnElapsedMs === undefined
        ? undefined
        : formatSessionDuration(session.turnElapsedMs),
    requiresAttention: session.requiresAttention,
    canSelect: session.canSelect,
  };
}

export function buildSessionPresentation(
  snapshot: DesktopSnapshot,
  limit = 6,
): SessionPresentation {
  const sessions = [...(snapshot.sessionOverview?.sessions ?? [])].sort(
    (left, right) =>
      Number(right.requiresAttention) - Number(left.requiresAttention) ||
      Number(ACTIVE_SESSION_STATES.has(right.state)) -
        Number(ACTIVE_SESSION_STATES.has(left.state)) ||
      right.lastActivityAt - left.lastActivityAt,
  );
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return {
    totalCount: sessions.length,
    activeCount: Math.max(0, Math.floor(snapshot.activeThreadCount)),
    todayActiveLabel: formatSessionDuration(snapshot.sessionOverview?.todayActiveMs ?? 0),
    items: sessions.slice(0, safeLimit).map(toPresentationItem),
  };
}
