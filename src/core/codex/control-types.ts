export type ThreadStatus = "idle" | "running" | "waiting" | "completed" | "error" | "closed";
export type ThreadSource = "created-by-pet" | "observed";
export type TurnMode = "normal" | "approval-test" | "input-test";

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
  cwd: string;
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
  kind: "approval-allow" | "approval-deny" | "user-input";
  threadIdHash: string;
  turnIdHash?: string;
  requestIdHash?: string;
  startedAt: number;
  completedAt?: number;
  result: "passed" | "failed" | "not-run";
  failureCode?: string;
}

export interface CodexRpcClient {
  sendRequest<T = unknown>(method: string, params?: unknown): Promise<T>;
}
