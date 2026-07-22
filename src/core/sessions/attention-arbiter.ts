import {
  ACTIVE_SESSION_STATES,
  type AgentSessionRecord,
  type AgentSessionState,
  type SessionAttentionSnapshot,
  type SessionRegistrySnapshot,
} from "./session-types";

const PRIORITY: Readonly<Record<AgentSessionState, number>> = {
  closed: 0,
  offline: 1,
  idle: 2,
  success: 3,
  interrupted: 3,
  thinking: 4,
  working: 5,
  error: 6,
  approval: 7,
  waiting_input: 8,
};

function isPrimaryState(state: AgentSessionState): SessionAttentionSnapshot["primaryState"] {
  return state === "closed" || state === "interrupted" ? "idle" : state;
}

export function arbitrateSessionAttention(
  snapshot: SessionRegistrySnapshot,
): SessionAttentionSnapshot {
  const sessions = [...snapshot.sessions];
  const active = sessions.filter((session) => ACTIVE_SESSION_STATES.has(session.state));
  const ordered = sessions.sort((left, right) => {
    if (left.requiresAttention !== right.requiresAttention) return left.requiresAttention ? -1 : 1;
    return (
      PRIORITY[right.state] - PRIORITY[left.state] ||
      right.lastActivityAt - left.lastActivityAt ||
      left.sessionId.localeCompare(right.sessionId)
    );
  });
  const primary = ordered[0];
  const count = (state: AgentSessionState) =>
    sessions.filter((session) => session.state === state).length;
  const primaryState = primary ? isPrimaryState(primary.state) : "idle";
  return {
    primarySessionId: primary?.sessionId,
    primaryState,
    concurrencyLevel: active.length,
    presentationHint: primary?.requiresAttention
      ? "needs-attention"
      : active.length > 1
        ? "multi-session"
        : active.length === 1
          ? "single-session"
          : "idle",
    secondarySessions: ordered.slice(1, 5).map((session: AgentSessionRecord) => ({
      sessionId: session.sessionId,
      state: session.state,
    })),
    counts: {
      active: active.length,
      thinking: count("thinking"),
      working: count("working"),
      approvals: count("approval"),
      waitingInputs: count("waiting_input"),
      errors: count("error"),
    },
  };
}
