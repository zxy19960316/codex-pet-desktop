export type AgentSessionState =
  | "idle"
  | "thinking"
  | "working"
  | "approval"
  | "waiting_input"
  | "success"
  | "error"
  | "interrupted"
  | "offline"
  | "closed";

export type SessionObservationSource = "codex-app-server" | "codex-hooks" | "codex-session-file";

export type SessionTitlePrivacy = "safe-title" | "project-only" | "anonymous";

export type SessionLifecycleEvent =
  | "session_started"
  | "turn_started"
  | "state_changed"
  | "approval_required"
  | "input_required"
  | "turn_completed"
  | "turn_failed"
  | "turn_interrupted"
  | "session_closed";

export interface AgentSessionRecord {
  providerId: "codex";
  sessionId: string;
  safeTitle: string;
  projectLabel?: string;
  state: AgentSessionState;
  startedAt: number;
  currentTurnStartedAt?: number;
  lastActivityAt: number;
  completedAt?: number;
  activeWorkMs: number;
  requiresAttention: boolean;
  canSelect: boolean;
  canInterrupt: boolean;
  canSteer: boolean;
  canReviewApproval: boolean;
  canReply: boolean;
  activeTurnId?: string;
  sources: SessionObservationSource[];
}

export interface SessionObservation {
  providerId: "codex";
  sessionId: string;
  source: SessionObservationSource;
  timestamp: number;
  state?: AgentSessionState;
  title?: string;
  projectLabel?: string;
  turnId?: string;
  event?: SessionLifecycleEvent;
  capabilities?: {
    canSelect?: boolean;
    canInterrupt?: boolean;
    canSteer?: boolean;
  };
}

export interface SessionRegistrySnapshot {
  sessions: AgentSessionRecord[];
  generatedAt: number;
}

export const ACTIVE_SESSION_STATES: ReadonlySet<AgentSessionState> = new Set([
  "thinking",
  "working",
  "approval",
  "waiting_input",
]);

export const ATTENTION_SESSION_STATES: ReadonlySet<AgentSessionState> = new Set([
  "approval",
  "waiting_input",
  "error",
]);
