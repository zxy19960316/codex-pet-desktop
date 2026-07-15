export type ThreadStatus = "idle" | "running" | "waiting" | "completed" | "error" | "closed";
export type ThreadSource = "created-by-pet" | "observed";
export type TurnMode = "normal" | "approval-test" | "input-test" | "steer-test" | "interrupt-test";

export type DeveloperCwdSelection =
  | { kind: "project-root" }
  | { kind: "e2e-root" }
  | { kind: "project-relative"; relativePath: string };

export type E2EVerificationKind =
  "approval-allow" | "approval-deny" | "user-input" | "steer" | "interrupt";

export type E2EVerificationStepState =
  "not-run" | "waiting-for-user" | "waiting-for-codex" | "passed" | "failed";

export interface E2EVerificationStep {
  kind: E2EVerificationKind;
  state: E2EVerificationStepState;
  recordId?: string;
  failureCode?: string;
}

export interface CodexThreadSnapshot {
  threadId: string;
  cwd?: string;
  title?: string;
  status: ThreadStatus;
  activeTurnId?: string;
  createdAt: number;
  updatedAt: number;
  source: ThreadSource;
}

export interface CreateThreadRequest {
  cwd: DeveloperCwdSelection;
}

export interface StartTurnRequest {
  threadId: string;
  prompt: string;
  mode: TurnMode;
}

export interface SteerTurnRequest {
  threadId: string;
  expectedTurnId: string;
  message: string;
}

export interface InterruptTurnRequest {
  threadId: string;
  turnId: string;
}

export interface E2EVerificationRecord {
  id: string;
  kind: E2EVerificationKind;
  threadIdHash?: string;
  turnIdHash?: string;
  requestIdHash?: string;
  startedAt: number;
  completedAt?: number;
  result: "running" | "passed" | "failed" | "not-run";
  failureCode?: string;
  protocolEvidence?: string[];
}

export interface CodexRpcClient {
  sendRequest<T = unknown>(method: string, params?: unknown): Promise<T>;
}
