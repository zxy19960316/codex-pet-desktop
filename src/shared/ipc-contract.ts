import type { ApprovalDecision, ApprovalRequest } from "../core/codex/approval-router";
import type { AppServerStatus } from "../core/codex/app-server-process";
import type { DailyUsage, RateLimitBucket } from "../core/codex/usage-provider";
import type { ThreadTokenUsage } from "../core/codex/usage-provider";
import type { UserInputAnswers, UserInputRequest } from "../core/input/input-types";
import type { PetState, PetStateChange } from "../core/pet/pet-state";
import type { LocalSettings } from "./settings";
import type {
  CodexThreadSnapshot,
  CreateThreadRequest,
  E2EVerificationRecord,
  E2EVerificationKind,
  E2EVerificationStep,
  InterruptTurnRequest,
  StartTurnRequest,
  SteerTurnRequest,
} from "../core/codex/control-types";

export const IPC_CHANNELS = {
  getSnapshot: "desktop:get-snapshot",
  snapshot: "desktop:snapshot",
  setPetState: "desktop:set-pet-state",
  respondApproval: "desktop:respond-approval",
  toggleHud: "desktop:toggle-hud",
  toggleDebug: "desktop:toggle-debug",
  toggleAlwaysOnTop: "desktop:toggle-always-on-top",
  toggleClickThrough: "desktop:toggle-click-through",
  reconnectCodex: "desktop:reconnect-codex",
  patchSettings: "desktop:patch-settings",
  enqueueMockApproval: "desktop:enqueue-mock-approval",
  respondUserInput: "desktop:respond-user-input",
  cancelUserInput: "desktop:cancel-user-input",
  enqueueMockUserInput: "desktop:enqueue-mock-user-input",
  createThread: "desktop:create-thread",
  startTurn: "desktop:start-turn",
  steerTurn: "desktop:steer-turn",
  interruptTurn: "desktop:interrupt-turn",
  selectThread: "desktop:select-thread",
  runApprovalTest: "desktop:run-approval-test",
  runUserInputTest: "desktop:run-user-input-test",
  startVerification: "desktop:start-verification",
  runVerification: "desktop:run-verification",
  quit: "desktop:quit",
} as const;

export type CwdLabel = "Project root" | "Disposable tmp/e2e" | "Project-relative folder";

export type DesktopThreadSnapshot = Omit<CodexThreadSnapshot, "cwd"> & {
  cwdLabel: CwdLabel;
};

export interface DesktopSnapshot {
  connectionStatus: AppServerStatus;
  connectionDetail?: string;
  petState: PetState;
  threadStates: PetStateChange[];
  activeThreadCount: number;
  currentCwdLabel: CwdLabel;
  approvals: ApprovalRequest[];
  userInputs: UserInputRequest[];
  rateLimits: RateLimitBucket[] | null;
  dailyUsage: DailyUsage | null;
  threadTokenUsage: ThreadTokenUsage[];
  selectedThreadId?: string;
  selectedThread?: DesktopThreadSnapshot;
  threads: DesktopThreadSnapshot[];
  e2eRecords: E2EVerificationRecord[];
  e2eSteps: E2EVerificationStep[];
  currentThreadTokens: number | null;
  settings: LocalSettings;
  protocolSource: "codex-app-server" | "mock" | "unavailable";
}

export interface DesktopApi {
  getSnapshot(): Promise<DesktopSnapshot>;
  subscribe(listener: (snapshot: DesktopSnapshot) => void): () => void;
  setPetState(state: PetState): Promise<void>;
  respondApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
  toggleHud(): Promise<void>;
  toggleDebug(): Promise<void>;
  toggleAlwaysOnTop(): Promise<void>;
  toggleClickThrough(): Promise<void>;
  reconnectCodex(): Promise<void>;
  patchSettings(patch: Partial<LocalSettings>): Promise<void>;
  enqueueMockApproval(): Promise<void>;
  respondUserInput(requestId: string, answers: UserInputAnswers): Promise<void>;
  cancelUserInput(requestId: string): Promise<void>;
  enqueueMockUserInput(): Promise<void>;
  createThread(request: CreateThreadRequest): Promise<void>;
  startTurn(request: StartTurnRequest): Promise<string>;
  steerTurn(request: SteerTurnRequest): Promise<void>;
  interruptTurn(request: InterruptTurnRequest): Promise<void>;
  selectThread(threadId: string): Promise<void>;
  runApprovalTest(): Promise<string>;
  runUserInputTest(): Promise<string>;
  startVerification(): Promise<void>;
  runVerification(kind: E2EVerificationKind): Promise<string>;
  quit(): Promise<void>;
}
