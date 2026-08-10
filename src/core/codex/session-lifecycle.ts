import type { AgentSessionState, SessionObservation } from "../sessions/session-types";

export interface SessionLifecycleCursor {
  sessionId?: string;
  turnId?: string;
  state?: AgentSessionState;
  sessionStarted: boolean;
}

export interface SessionLifecycleParseResult {
  cursor: SessionLifecycleCursor;
  observations: SessionObservation[];
}

const ACTIVE_TURN_STATES: ReadonlySet<AgentSessionState | undefined> = new Set([
  "thinking",
  "working",
  "approval",
  "waiting_input",
]);

const RESPONSE_WORK_TYPES: ReadonlySet<string> = new Set([
  "function_call",
  "function_call_output",
  "custom_tool_call",
  "custom_tool_call_output",
  "local_shell_call",
  "local_shell_call_output",
  "web_search_call",
  "computer_tool_call",
  "image_generation_call",
  "mcp_call",
  "mcp_call_output",
]);

const EVENT_WORK_TYPES: ReadonlySet<string> = new Set([
  "mcp_tool_call_begin",
  "mcp_tool_call_end",
  "patch_apply_begin",
  "patch_apply_end",
  "exec_command_begin",
  "exec_command_end",
]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9._:-]+$/.test(value)
    ? value
    : undefined;
}

function safeTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== "string" || value.length > 64) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : undefined;
}

function observation(
  cursor: SessionLifecycleCursor,
  timestamp: number,
  fields: Pick<SessionObservation, "event" | "state" | "turnId">,
): SessionObservation | undefined {
  if (!cursor.sessionId) return undefined;
  return {
    providerId: "codex",
    sessionId: cursor.sessionId,
    source: "codex-session-file",
    timestamp,
    ...fields,
  };
}

function beginSession(
  cursor: SessionLifecycleCursor,
  observations: SessionObservation[],
  timestamp: number,
): boolean {
  if (!cursor.sessionId || cursor.sessionStarted) return Boolean(cursor.sessionId);
  const started = observation(cursor, timestamp, { event: "session_started" });
  if (!started) return false;
  observations.push(started);
  cursor.sessionStarted = true;
  cursor.state = "idle";
  return true;
}

function emitState(
  cursor: SessionLifecycleCursor,
  observations: SessionObservation[],
  timestamp: number,
  state: AgentSessionState,
): void {
  if (cursor.state === state || !beginSession(cursor, observations, timestamp)) return;
  const changed = observation(cursor, timestamp, {
    event: "state_changed",
    state,
    turnId: cursor.turnId,
  });
  if (!changed) return;
  observations.push(changed);
  cursor.state = state;
}

function emitTurnStart(
  cursor: SessionLifecycleCursor,
  observations: SessionObservation[],
  timestamp: number,
  turnId: string | undefined,
): void {
  if (!beginSession(cursor, observations, timestamp)) return;
  const isNewTurn = Boolean(turnId) && turnId !== cursor.turnId;
  if (!isNewTurn && ACTIVE_TURN_STATES.has(cursor.state)) return;
  if (turnId) cursor.turnId = turnId;
  const started = observation(cursor, timestamp, {
    event: "turn_started",
    state: "working",
    turnId: cursor.turnId,
  });
  if (!started) return;
  observations.push(started);
  cursor.state = "working";
}

function emitTerminal(
  cursor: SessionLifecycleCursor,
  observations: SessionObservation[],
  timestamp: number,
  turnId: string | undefined,
  event: "turn_completed" | "turn_failed" | "turn_interrupted",
  state: "success" | "error" | "interrupted",
): void {
  if (!beginSession(cursor, observations, timestamp)) return;
  const terminalTurnId = turnId ?? cursor.turnId;
  if (cursor.state === state && (!terminalTurnId || terminalTurnId === cursor.turnId)) return;
  if (terminalTurnId) cursor.turnId = terminalTurnId;
  const terminal = observation(cursor, timestamp, {
    event,
    state,
    turnId: cursor.turnId,
  });
  if (!terminal) return;
  observations.push(terminal);
  cursor.state = state;
}

export function parseSessionLifecycle(
  content: string,
  initial?: SessionLifecycleCursor,
  fallbackSessionId?: string,
): SessionLifecycleParseResult {
  const cursor: SessionLifecycleCursor = {
    sessionId: safeIdentifier(initial?.sessionId) ?? safeIdentifier(fallbackSessionId),
    turnId: safeIdentifier(initial?.turnId),
    state: initial?.state,
    sessionStarted: initial?.sessionStarted ?? false,
  };
  const observations: SessionObservation[] = [];

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const root = record(parsed);
    const payload = record(root?.payload);
    const timestamp = safeTimestamp(root?.timestamp);
    if (!root || !payload || timestamp === undefined) continue;

    if (root.type === "session_meta") {
      const sessionId = safeIdentifier(payload.id) ?? safeIdentifier(payload.session_id);
      if (!sessionId) continue;
      if (!cursor.sessionStarted) cursor.sessionId = sessionId;
      beginSession(cursor, observations, timestamp);
      continue;
    }

    const turnId = safeIdentifier(payload.turn_id);

    if (root.type === "turn_context") {
      emitTurnStart(cursor, observations, timestamp, turnId);
      continue;
    }
    const payloadType = safeIdentifier(payload.type);
    if (!payloadType) continue;
    if (root.type === "event_msg") {
      if (payloadType === "task_started") {
        emitTurnStart(cursor, observations, timestamp, turnId);
        continue;
      }
      if (payloadType === "agent_reasoning") {
        emitState(cursor, observations, timestamp, "thinking");
        continue;
      }
      if (EVENT_WORK_TYPES.has(payloadType)) {
        emitState(cursor, observations, timestamp, "working");
        continue;
      }
      if (payloadType === "task_complete") {
        emitTerminal(cursor, observations, timestamp, turnId, "turn_completed", "success");
        continue;
      }
      if (payloadType === "task_failed") {
        emitTerminal(cursor, observations, timestamp, turnId, "turn_failed", "error");
        continue;
      }
      if (["task_cancelled", "task_aborted", "task_interrupted"].includes(payloadType)) {
        emitTerminal(cursor, observations, timestamp, turnId, "turn_interrupted", "interrupted");
      }
      continue;
    }
    if (root.type !== "response_item") continue;
    if (payloadType === "reasoning") {
      emitState(cursor, observations, timestamp, "thinking");
      continue;
    }
    if (RESPONSE_WORK_TYPES.has(payloadType)) emitState(cursor, observations, timestamp, "working");
  }

  return { cursor, observations };
}
