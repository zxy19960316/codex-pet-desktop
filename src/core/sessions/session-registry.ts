import {
  ACTIVE_SESSION_STATES,
  ATTENTION_SESSION_STATES,
  type AgentSessionRecord,
  type AgentSessionState,
  type SessionObservation,
  type SessionRegistrySnapshot,
} from "./session-types";
import { resolveSessionTitle, sanitizeSessionTitle } from "./session-title";
import { accumulateActiveWork } from "./session-clock";

interface StoredSession extends AgentSessionRecord {
  lastStateAt: number;
  fallbackNumber: number;
}

export interface SessionRegistryOptions {
  maxRecords?: number;
  maxSnapshotSessions?: number;
  completedRetentionMs?: number;
  inactiveRetentionMs?: number;
}

const ACTIVE_SORT_STATES: ReadonlySet<AgentSessionState> = new Set([
  "thinking",
  "working",
  "approval",
  "waiting_input",
]);

function finiteTimestamp(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function clone(record: AgentSessionRecord): AgentSessionRecord {
  return { ...record, sources: [...record.sources] };
}

function stateFor(observation: SessionObservation, current: AgentSessionState): AgentSessionState {
  if (observation.state) return observation.state;
  switch (observation.event) {
    case "session_started":
      return "idle";
    case "turn_started":
      return "working";
    case "approval_required":
      return "approval";
    case "input_required":
      return "waiting_input";
    case "turn_completed":
      return "success";
    case "turn_failed":
      return "error";
    case "turn_interrupted":
      return "interrupted";
    case "session_closed":
      return "closed";
    default:
      return current;
  }
}

export class SessionRegistry {
  readonly #records = new Map<string, StoredSession>();
  readonly #maxRecords: number;
  readonly #maxSnapshotSessions: number;
  readonly #completedRetentionMs: number;
  readonly #inactiveRetentionMs: number;
  #nextFallbackNumber = 1;

  constructor(options: SessionRegistryOptions = {}) {
    this.#maxRecords = options.maxRecords ?? 100;
    this.#maxSnapshotSessions = options.maxSnapshotSessions ?? 20;
    this.#completedRetentionMs = options.completedRetentionMs ?? 10 * 60_000;
    this.#inactiveRetentionMs = options.inactiveRetentionMs ?? 60 * 60_000;
  }

  observe(observation: SessionObservation): SessionRegistrySnapshot {
    if (
      observation.providerId !== "codex" ||
      !observation.sessionId ||
      observation.sessionId.length > 512 ||
      !finiteTimestamp(observation.timestamp)
    )
      return this.getSnapshot();
    let record = this.#records.get(observation.sessionId);
    if (!record) {
      const fallbackNumber = this.#nextFallbackNumber++;
      record = {
        providerId: "codex",
        sessionId: observation.sessionId,
        safeTitle: resolveSessionTitle({ fallbackNumber }),
        state: "idle",
        startedAt: observation.timestamp,
        lastActivityAt: observation.timestamp,
        activeWorkMs: 0,
        requiresAttention: false,
        canSelect: false,
        canInterrupt: false,
        canSteer: false,
        canReviewApproval: false,
        canReply: false,
        sources: [],
        lastStateAt: observation.timestamp,
        fallbackNumber,
      };
      this.#records.set(observation.sessionId, record);
    }
    if (!record.sources.includes(observation.source)) {
      record.sources.push(observation.source);
      record.sources.sort();
    }
    if (observation.timestamp >= record.lastActivityAt) {
      record.activeWorkMs = accumulateActiveWork(
        record.activeWorkMs,
        record.state,
        record.lastActivityAt,
        observation.timestamp,
      );
      record.lastActivityAt = observation.timestamp;
    }
    const projectLabel = sanitizeSessionTitle(observation.projectLabel ?? "");
    if (projectLabel && observation.timestamp >= record.lastStateAt)
      record.projectLabel = projectLabel;
    const title = sanitizeSessionTitle(observation.title ?? "");
    if (title && observation.timestamp >= record.lastStateAt)
      record.safeTitle = resolveSessionTitle({
        title,
        projectLabel: record.projectLabel,
        fallbackNumber: record.fallbackNumber,
      });
    else if (!title && projectLabel && observation.timestamp >= record.lastStateAt)
      record.safeTitle = resolveSessionTitle({
        projectLabel,
        fallbackNumber: record.fallbackNumber,
      });
    if (observation.source === "codex-app-server" && observation.capabilities) {
      for (const key of ["canSelect", "canInterrupt", "canSteer"] as const) {
        if (typeof observation.capabilities[key] === "boolean")
          record[key] = observation.capabilities[key];
      }
    }
    const desired = stateFor(observation, record.state);
    const canReviveClosed = record.state === "closed" && observation.event === "session_started";
    if (
      (record.state !== "closed" || canReviveClosed) &&
      observation.timestamp >= record.lastStateAt
    ) {
      record.state = desired;
      record.lastStateAt = observation.timestamp;
      if (observation.event === "session_started") {
        record.startedAt = observation.timestamp;
        record.completedAt = undefined;
        record.currentTurnStartedAt = undefined;
        record.activeTurnId = undefined;
      }
      if (observation.event === "turn_started") {
        record.currentTurnStartedAt = observation.timestamp;
        record.activeTurnId = observation.turnId;
        record.completedAt = undefined;
      }
      if (
        ["turn_completed", "turn_failed", "turn_interrupted", "session_closed"].includes(
          observation.event ?? "",
        )
      ) {
        record.completedAt = observation.timestamp;
        record.currentTurnStartedAt = undefined;
        record.activeTurnId = undefined;
      }
      if (observation.event === "approval_required") record.canReviewApproval = true;
      if (observation.event === "input_required") record.canReply = true;
      if (
        ["turn_completed", "turn_failed", "turn_interrupted", "session_closed"].includes(
          observation.event ?? "",
        )
      ) {
        record.canReviewApproval = false;
        record.canReply = false;
      }
      record.requiresAttention = ATTENTION_SESSION_STATES.has(record.state);
    }
    this.#evictOverflow();
    return this.getSnapshot(observation.timestamp);
  }

  getSession(sessionId: string): AgentSessionRecord | undefined {
    const record = this.#records.get(sessionId);
    return record ? clone(record) : undefined;
  }

  getSnapshot(now = Date.now()): SessionRegistrySnapshot {
    const generatedAt = finiteTimestamp(now) ? now : Date.now();
    const sessions = [...this.#records.values()]
      .sort((left, right) => {
        if (left.requiresAttention !== right.requiresAttention)
          return left.requiresAttention ? -1 : 1;
        const leftActive = ACTIVE_SORT_STATES.has(left.state);
        const rightActive = ACTIVE_SORT_STATES.has(right.state);
        if (leftActive !== rightActive) return leftActive ? -1 : 1;
        return (
          right.lastActivityAt - left.lastActivityAt ||
          left.sessionId.localeCompare(right.sessionId)
        );
      })
      .slice(0, this.#maxSnapshotSessions)
      .map(clone);
    return { sessions, generatedAt };
  }

  closeSession(sessionId: string, timestamp: number): void {
    this.observe({
      providerId: "codex",
      sessionId,
      source: "codex-hooks",
      timestamp,
      event: "session_closed",
    });
  }

  prune(now: number): void {
    if (!finiteTimestamp(now)) return;
    for (const [sessionId, record] of this.#records) {
      const retention = ["success", "error", "interrupted", "closed"].includes(record.state)
        ? this.#completedRetentionMs
        : this.#inactiveRetentionMs;
      if (now - record.lastActivityAt > retention) this.#records.delete(sessionId);
    }
    this.#evictOverflow();
  }

  reset(): void {
    this.#records.clear();
    this.#nextFallbackNumber = 1;
  }

  #evictOverflow(): void {
    if (this.#records.size <= this.#maxRecords) return;
    const removable = [...this.#records.values()]
      .filter((record) => !ACTIVE_SESSION_STATES.has(record.state))
      .sort((left, right) => left.lastActivityAt - right.lastActivityAt);
    for (const record of removable) {
      if (this.#records.size <= this.#maxRecords) break;
      this.#records.delete(record.sessionId);
    }
  }
}
