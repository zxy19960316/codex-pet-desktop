import {
  ApprovalRouter,
  type ApprovalDecision,
  type ApprovalRequest,
} from "../core/codex/approval-router";
import {
  AppServerProcess,
  type AppServerProcessOptions,
  type AppServerStatus,
} from "../core/codex/app-server-process";
import { EventNormalizer, type DomainEvent } from "../core/codex/event-normalizer";
import { hookEventToPetState, type CodexHookEvent } from "../core/codex/hook-event";
import { ServerRequestRegistry } from "../core/codex/server-request-registry";
import {
  CodexUsageProvider,
  MockUsageProvider,
  normalizeThreadTokenUsage,
  type ThreadTokenUsage,
  type DailyUsage,
  type RateLimitBucket,
  type UsageProvider,
} from "../core/codex/usage-provider";
import { InputRouter } from "../core/input/input-router";
import type { UserInputAnswers, UserInputRequest } from "../core/input/input-types";
import {
  type CreateThreadRequest,
  type E2EVerificationKind,
  type InterruptTurnRequest,
  type StartTurnRequest,
  type SteerTurnRequest,
} from "../core/codex/control-types";
import { ThreadController } from "../core/codex/thread-controller";
import { TurnController } from "../core/codex/turn-controller";
import { E2EVerificationStore } from "../core/codex/e2e-verification-store";
import { randomUUID } from "node:crypto";
import { SafeLogger } from "../core/logging/logger";
import { PetStateMachine } from "../core/pet/state-machine";
import type { PetState, PetStateChange } from "../core/pet/pet-state";
import { type DesktopSnapshot } from "../shared/ipc-contract";
import { DEFAULT_SETTINGS, type LocalSettings } from "../shared/settings";
import { SnapshotAssembler } from "./snapshot-assembler";
import type { AgentTelemetry } from "../core/codex/session-telemetry";
import { arbitrateSessionAttention } from "../core/sessions/attention-arbiter";
import {
  observationFromHook,
  observationFromPetState,
} from "../core/sessions/codex-session-observation";
import { sessionElapsedMs, turnElapsedMs } from "../core/sessions/session-clock";
import { SessionRegistry } from "../core/sessions/session-registry";
import type { AgentSessionState } from "../core/sessions/session-types";

export interface RuntimeControllerOptions {
  logger: SafeLogger;
  initialSettings: LocalSettings;
  publish: (snapshot: DesktopSnapshot) => void;
  persistSettings?: (patch: Partial<LocalSettings>) => Promise<LocalSettings>;
  onSettingsChanged?: (settings: LocalSettings) => void;
  createAppServer?: (options: AppServerProcessOptions) => AppServerProcess;
  onActiveInterval?: (milliseconds: number, timestamp: number) => void;
  todayActiveMs?: () => number;
}

const BOOLEAN_SETTINGS = [
  "alwaysOnTop",
  "clickThrough",
  "hudVisible",
  "debugVisible",
  "useMockData",
  "autoStartAppServer",
  "launchAtLogin",
  "soundEnabled",
  "lockPhysicalSizeAcrossDisplays",
] as const;

function safeSettingsPatch(patch: Partial<LocalSettings>): Partial<LocalSettings> {
  const safe: Partial<LocalSettings> = {};
  for (const key of BOOLEAN_SETTINGS) if (typeof patch[key] === "boolean") safe[key] = patch[key];
  if (typeof patch.quotaWarningPercent === "number" && Number.isFinite(patch.quotaWarningPercent))
    safe.quotaWarningPercent = patch.quotaWarningPercent;
  if (typeof patch.scalePercent === "number" && Number.isFinite(patch.scalePercent))
    safe.scalePercent = patch.scalePercent;
  return safe;
}

interface VerificationTurn {
  kind: E2EVerificationKind;
  recordId: string;
  requestId?: string;
  responseReceived: boolean;
  serverResolved: boolean;
  steerSent: boolean;
  containsSteered: boolean;
  commandObserved: boolean;
  terminalStatus?: "completed" | "interrupted" | "cancelled" | "failed" | "unknown";
}

function modeForVerification(kind: E2EVerificationKind): StartTurnRequest["mode"] {
  if (kind === "approval-allow" || kind === "approval-deny") return "approval-test";
  if (kind === "user-input") return "input-test";
  if (kind === "steer") return "steer-test";
  return "interrupt-test";
}

function petStateFromSession(state: AgentSessionState): PetState {
  if (state === "working") return "working";
  if (state === "thinking") return "thinking";
  if (state === "approval") return "approval";
  if (state === "waiting_input") return "waiting_input";
  if (state === "success") return "success";
  if (state === "error") return "error";
  if (state === "offline") return "offline";
  return "idle";
}

export class RuntimeController {
  readonly #logger: SafeLogger;
  readonly #publishSnapshot: RuntimeControllerOptions["publish"];
  readonly #persistSettings?: RuntimeControllerOptions["persistSettings"];
  readonly #onSettingsChanged?: RuntimeControllerOptions["onSettingsChanged"];
  readonly #onActiveInterval?: RuntimeControllerOptions["onActiveInterval"];
  readonly #todayActiveMs: NonNullable<RuntimeControllerOptions["todayActiveMs"]>;
  readonly #normalizer = new EventNormalizer();
  readonly #actualStates = new Map<string, PetStateChange>();
  readonly #threadTokenUsage = new Map<string, ThreadTokenUsage>();
  readonly #petStateMachine: PetStateMachine;
  readonly #approvalRouter: ApprovalRouter;
  readonly #inputRouter: InputRouter;
  readonly #serverRequests: ServerRequestRegistry;
  readonly #appServer: AppServerProcess;
  readonly #threadController = new ThreadController(process.cwd());
  readonly #turnController = new TurnController(this.#threadController);
  readonly #e2eStore = new E2EVerificationStore();
  readonly #snapshotAssembler = new SnapshotAssembler();
  readonly #sessionRegistry = new SessionRegistry();
  readonly #testTurns = new Map<string, VerificationTurn>();
  #settings: LocalSettings;
  #usageProvider?: UsageProvider;
  #rateLimits: RateLimitBucket[] | null = null;
  #dailyUsage: DailyUsage | null = null;
  #connectionStatus: AppServerStatus = "stopped";
  #connectionDetail?: string;
  #protocolSource: DesktopSnapshot["protocolSource"] = "unavailable";
  #lastActiveThreadId?: string;
  #mockInputIndex = 0;
  #agentTelemetry: AgentTelemetry | null = null;
  #lastActivitySampleAt?: number;
  #wasSessionActive = false;

  constructor(options: RuntimeControllerOptions) {
    this.#logger = options.logger;
    this.#settings = { ...DEFAULT_SETTINGS, ...options.initialSettings };
    this.#publishSnapshot = options.publish;
    this.#persistSettings = options.persistSettings;
    this.#onSettingsChanged = options.onSettingsChanged;
    this.#onActiveInterval = options.onActiveInterval;
    this.#todayActiveMs = options.todayActiveMs ?? (() => 0);
    this.#petStateMachine = new PetStateMachine({ onChange: () => this.#emit() });
    this.#approvalRouter = new ApprovalRouter({
      onChange: () => this.#reconcileRequestStates(),
      respond: async (requestId, decision, request) =>
        this.#serverRequests.respondApproval(requestId, decision, request),
    });
    this.#inputRouter = new InputRouter({ onChange: () => this.#reconcileRequestStates() });
    this.#serverRequests = new ServerRequestRegistry({
      approvalRouter: this.#approvalRouter,
      inputRouter: this.#inputRouter,
      onApprovalQueued: (request) => this.#handleApprovalQueued(request),
      onInputQueued: (request) => this.#handleInputQueued(request),
      onApprovalDiagnostic: (diagnostic) =>
        this.#logger.write("debug", "approval-request", diagnostic),
    });
    const createAppServer = options.createAppServer ?? ((config) => new AppServerProcess(config));
    this.#appServer = createAppServer({
      onStatus: (status, detail) => this.#updateStatus(status, detail),
      onNotification: (method, params) => this.#applyNotification(method, params),
      onDiagnostic: (code) => this.#logger.write("debug", code),
      onClient: (client) => {
        this.#petStateMachine.remove("transport");
        this.#serverRequests.register(client);
        this.#usageProvider = new CodexUsageProvider(client);
        this.#protocolSource = "codex-app-server";
        void this.#refreshUsage(this.#usageProvider);
        this.#emit();
      },
    });
  }

  async start(): Promise<void> {
    await this.#connectCodex();
    this.#emit();
  }

  async stop(): Promise<void> {
    this.handleTransportUnavailable("Application shutdown");
    this.#serverRequests.unregister();
    this.#approvalRouter.dispose();
    this.#inputRouter.clearAll("Application shutdown");
    this.#petStateMachine.dispose();
    await Promise.allSettled([this.#usageProvider?.stop(), this.#appServer.stop()]);
    this.#usageProvider = undefined;
    this.#emit();
  }

  async reconnect(): Promise<void> {
    if (this.#settings.useMockData) {
      await this.#connectCodex();
      return;
    }
    this.handleTransportUnavailable("App Server reconnecting");
    await this.#appServer.reconnect();
  }

  getSnapshot(): DesktopSnapshot {
    const now = Date.now();
    this.#sessionRegistry.prune(now);
    const sessionSnapshot = this.#sessionRegistry.getSnapshot(now);
    const attention = arbitrateSessionAttention(sessionSnapshot);
    const sessionOverview = {
      sessions: sessionSnapshot.sessions.map((session) => ({
        sessionId: session.sessionId,
        title: session.safeTitle,
        projectLabel: session.projectLabel,
        state: session.state,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
        sessionElapsedMs: sessionElapsedMs(session.startedAt, now),
        turnElapsedMs: turnElapsedMs(session.startedAt, session.currentTurnStartedAt, now),
        activeWorkMs: session.activeWorkMs,
        requiresAttention: session.requiresAttention,
        canSelect: session.canSelect,
        canInterrupt: session.canInterrupt,
        canSteer: session.canSteer,
        canReviewApproval: session.canReviewApproval,
        canReply: session.canReply,
        activeTurnId: session.activeTurnId,
      })),
      attention,
      todayActiveMs: this.#todayActiveMs(),
    };
    const selected = this.#threadController.selectedThreadId ?? this.#lastActiveThreadId;
    const current = selected ? (this.#threadTokenUsage.get(selected)?.totalTokens ?? null) : null;
    return this.#snapshotAssembler.build({
      projectRoot: this.#threadController.projectRoot,
      e2eRoot: this.#threadController.e2eRoot,
      currentCwd: this.#threadController.currentCwd,
      connectionStatus: this.#connectionStatus,
      connectionDetail: this.#connectionDetail,
      petState: sessionSnapshot.sessions.length
        ? petStateFromSession(attention.primaryState)
        : this.#petStateMachine.getGlobalState(),
      threadStates: this.#petStateMachine.snapshot(),
      activeThreadCount: attention.concurrencyLevel,
      sessionOverview,
      approvals: this.#approvalRouter.getQueue(),
      userInputs: this.#inputRouter.snapshot(),
      rateLimits: this.#agentTelemetry?.rateLimits ?? this.#rateLimits,
      dailyUsage: this.#dailyUsage,
      threadTokenUsage: [...this.#threadTokenUsage.values()].map((usage) => ({ ...usage })),
      selectedThreadId: this.#threadController.selectedThreadId,
      selectedThread: this.#threadController.selected(),
      threads: this.#threadController.snapshot(),
      e2eRecords: this.#e2eStore.snapshot(),
      e2eSteps: this.#e2eStore.steps(),
      currentThreadTokens: this.#agentTelemetry?.currentTokens ?? current,
      contextWindowTokens: this.#agentTelemetry?.contextWindowTokens ?? null,
      agent: this.#agentTelemetry
        ? {
            model: this.#agentTelemetry.model,
            reasoningEffort: this.#agentTelemetry.reasoningEffort,
          }
        : undefined,
      settings: { ...this.#settings },
      protocolSource: this.#protocolSource,
    });
  }

  async patchSettings(patch: Partial<LocalSettings>): Promise<void> {
    const safe = safeSettingsPatch(patch);
    this.#settings = this.#persistSettings
      ? await this.#persistSettings(safe)
      : { ...this.#settings, ...safe };
    this.#onSettingsChanged?.(this.#settings);
    this.#emit();
    if ("useMockData" in safe || "autoStartAppServer" in safe) await this.#connectCodex();
  }

  applyAgentTelemetry(telemetry: AgentTelemetry): void {
    this.#agentTelemetry = {
      ...telemetry,
      rateLimits: telemetry.rateLimits?.map((bucket) => ({ ...bucket })) ?? null,
    };
    this.#emit();
  }

  async respondApproval(requestId: string, decision: ApprovalDecision): Promise<void> {
    const request = this.#approvalRouter.getQueue().find((item) => item.requestId === requestId);
    await this.#approvalRouter.respond(requestId, decision);
    const verification = request?.turnId ? this.#testTurns.get(request.turnId) : undefined;
    if (
      verification &&
      (verification.kind === "approval-allow" || verification.kind === "approval-deny")
    ) {
      const accepted = decision === "accept" || decision === "acceptForSession";
      const matched = verification.kind === "approval-allow" ? accepted : decision === "decline";
      if (!matched) {
        this.#e2eStore.fail(verification.recordId, "unexpected-approval-decision");
        if (request?.turnId) this.#testTurns.delete(request.turnId);
      } else {
        verification.responseReceived = true;
        this.#e2eStore.waitForCodex(verification.recordId);
      }
      this.#emit();
    }
  }

  async respondUserInput(requestId: string, answers: UserInputAnswers): Promise<void> {
    const request = this.#inputRouter.snapshot().find((item) => item.requestId === requestId);
    await this.#inputRouter.respond(requestId, answers);
    const verification = request?.turnId ? this.#testTurns.get(request.turnId) : undefined;
    if (verification?.kind === "user-input") {
      verification.responseReceived = true;
      this.#e2eStore.waitForCodex(verification.recordId);
      this.#emit();
    }
  }

  async cancelUserInput(requestId: string): Promise<void> {
    const request = this.#inputRouter.snapshot().find((item) => item.requestId === requestId);
    await this.#inputRouter.cancel(requestId);
    const verification = request?.turnId ? this.#testTurns.get(request.turnId) : undefined;
    if (verification?.kind === "user-input") {
      this.#e2eStore.fail(verification.recordId, "user-input-cancelled");
      if (request?.turnId) this.#testTurns.delete(request.turnId);
      this.#emit();
    }
  }

  setDebugPetState(state: PetState): void {
    const change: PetStateChange = {
      state,
      threadId: "debug",
      source: "debug-panel",
      timestamp: Date.now(),
    };
    this.#actualStates.set(change.threadId, change);
    this.#applyRequestState(change.threadId);
  }

  applyHookEvent(event: CodexHookEvent): void {
    if (this.#settings.useMockData) return;
    const change = hookEventToPetState(event);
    this.#sessionRegistry.observe(observationFromHook(event));
    this.#actualStates.set(change.threadId, change);
    this.#lastActiveThreadId = change.threadId;
    this.#connectionStatus = "connected";
    this.#connectionDetail = "Codex Hook active";
    this.#protocolSource = "codex-hooks";
    this.#applyRequestState(change.threadId);
  }

  enqueueMockApproval(): void {
    const request = this.#approvalRouter.enqueue(
      `mock-${Date.now()}`,
      "item/commandExecution/requestApproval",
      {
        threadId: "mock-thread",
        turnId: "mock-turn",
        itemId: "mock-item",
        reason: "Mock-only route and UI verification",
        command: "npm test -- --example-only",
        cwd: "sample/project",
        availableDecisions: ["accept", "decline", "cancel"],
        autoResolutionMs: 60_000,
      },
    );
    this.#applyRequestState(request.threadId);
  }

  enqueueMockUserInput(): void {
    const id = `mock-input-${Date.now()}`;
    const index = this.#mockInputIndex++ % 3;
    const request: UserInputRequest = {
      requestId: id,
      threadId: "mock-thread",
      turnId: "mock-turn",
      itemId: "mock-item",
      sourceMethod: "mock:item/tool/requestUserInput",
      receivedAt: Date.now(),
      isMock: true,
      questions:
        index === 0
          ? [
              {
                id: "compatibility",
                header: "Mock request",
                prompt: "Support the legacy format?",
                options: [
                  { id: "Yes", label: "Yes" },
                  { id: "No", label: "No" },
                ],
                allowFreeText: true,
                multiSelect: false,
                required: true,
                secret: false,
              },
            ]
          : index === 1
            ? [
                {
                  id: "targets",
                  header: "Mock request",
                  prompt: "Choose supported targets",
                  options: [
                    { id: "Desktop", label: "Desktop" },
                    { id: "CLI", label: "CLI" },
                    { id: "Web", label: "Web" },
                  ],
                  allowFreeText: false,
                  multiSelect: true,
                  required: true,
                  secret: false,
                },
              ]
            : [
                {
                  id: "notes",
                  header: "Mock request",
                  prompt: "Add a short note",
                  options: [],
                  allowFreeText: true,
                  multiSelect: false,
                  required: true,
                  secret: false,
                },
              ],
    };
    this.#inputRouter.enqueueMock(request);
    this.#applyRequestState(request.threadId);
  }

  async createThread(request: CreateThreadRequest): Promise<void> {
    await this.#threadController.create(request, this.#client());
    this.#emit();
  }

  async startTurn(request: StartTurnRequest): Promise<string> {
    const turnId = await this.#turnController.start(request, this.#client());
    this.#emit();
    return turnId;
  }

  async steerTurn(request: SteerTurnRequest): Promise<void> {
    await this.#turnController.steer(request, this.#client());
    const verification = this.#testTurns.get(request.expectedTurnId);
    if (verification?.kind === "steer") {
      verification.steerSent = true;
      this.#e2eStore.waitForCodex(verification.recordId, ["turn/steer"]);
    }
    this.#emit();
  }

  async interruptTurn(request: InterruptTurnRequest): Promise<void> {
    await this.#turnController.interrupt(request, this.#client());
    const verification = this.#testTurns.get(request.turnId);
    if (verification?.kind === "interrupt") {
      verification.responseReceived = true;
      this.#e2eStore.waitForCodex(verification.recordId, ["turn/interrupt"]);
    }
    this.#emit();
  }

  selectThread(threadId: string): void {
    this.#threadController.select(threadId);
    this.#emit();
  }

  setSelectedThreadId(threadId: string | undefined): void {
    if (threadId) this.selectThread(threadId);
  }

  async runApprovalTest(): Promise<string> {
    return this.runVerification("approval-allow");
  }

  async runUserInputTest(): Promise<string> {
    return this.runVerification("user-input");
  }

  startVerification(): void {
    this.#e2eStore.resetSteps();
    this.#emit();
  }

  async runVerification(kind: E2EVerificationKind): Promise<string> {
    if (this.#settings.useMockData || this.#protocolSource !== "codex-app-server")
      throw new Error("Real verification is unavailable while Mock data is enabled");
    if (this.#connectionStatus !== "connected")
      throw new Error("Codex App Server is not connected");
    const directoryName = kind + "-" + randomUUID().slice(0, 8);
    const thread = await this.#threadController.createE2eThread(directoryName, this.#client());
    this.#threadController.select(thread.threadId);
    const record = this.#e2eStore.start(kind, { threadId: thread.threadId });
    try {
      const turnId = await this.#turnController.start(
        {
          threadId: thread.threadId,
          prompt: "developer verification",
          mode: modeForVerification(kind),
        },
        this.#client(),
      );
      this.#e2eStore.attach(record.id, { turnId });
      this.#testTurns.set(turnId, {
        kind,
        recordId: record.id,
        responseReceived: false,
        serverResolved: false,
        steerSent: false,
        containsSteered: false,
        commandObserved: false,
      });
      if (kind === "steer" || kind === "interrupt")
        this.#e2eStore.waitForUser(record.id, "turn/start");
      this.#emit();
      return turnId;
    } catch (error) {
      this.#e2eStore.fail(record.id, "turn-start-failed");
      this.#emit();
      throw error;
    }
  }

  async #connectCodex(): Promise<void> {
    if (this.#settings.useMockData) {
      await this.#appServer.stop();
      this.handleTransportUnavailable("Mock mode enabled");
      this.#usageProvider = new MockUsageProvider();
      this.#protocolSource = "mock";
      this.#connectionStatus = "stopped";
      this.#connectionDetail = "Mock data enabled";
      await this.#refreshUsage(this.#usageProvider);
      return;
    }
    if (!this.#settings.autoStartAppServer) return;
    this.#protocolSource = "unavailable";
    this.#rateLimits = null;
    this.#dailyUsage = null;
    try {
      await this.#appServer.start();
    } catch (error) {
      this.#logger.write("warn", "app-server-connect-failed", {
        errorName: error instanceof Error ? error.name : "unknown",
      });
      this.#connectionDetail = "App Server unavailable; enable Mock data in debug controls";
      this.#emit();
    }
  }

  async #refreshUsage(provider: UsageProvider): Promise<void> {
    const [limits, daily] = await Promise.allSettled([
      provider.readRateLimits(),
      provider.readDailyUsage(),
    ]);
    this.#rateLimits = limits.status === "fulfilled" ? limits.value : null;
    this.#dailyUsage = daily.status === "fulfilled" ? daily.value : null;
    this.#emit();
  }

  #updateStatus(status: AppServerStatus, detail?: string): void {
    this.#connectionStatus = status;
    this.#connectionDetail = detail;
    if (status === "error" || status === "stopped" || status === "reconnecting")
      this.handleTransportUnavailable("App Server disconnected");
    this.#emit();
  }

  handleTransportUnavailable(reason: string): void {
    this.#serverRequests.clearAll(reason);
    this.#turnController.clearSending();
    this.#e2eStore.failRunning("transport-unavailable", ["transport-unavailable"]);
    this.#testTurns.clear();
    this.#actualStates.clear();
    this.#sessionRegistry.reset();
    for (const state of this.#petStateMachine.snapshot())
      this.#petStateMachine.remove(state.threadId);
    this.#petStateMachine.update({
      threadId: "transport",
      state: "idle",
      source: "transport-unavailable",
      timestamp: Date.now(),
    });
    this.#threadController.clearTransient();
    this.#emit();
  }

  #applyNotification(method: string, params: unknown): void {
    this.#threadController.observe(method, params);
    for (const event of this.#normalizer.normalizeNotification(method, params))
      this.#applyEvent(event);
  }

  #applyEvent(event: DomainEvent): void {
    if (event.type === "pet-state") {
      this.#sessionRegistry.observe(observationFromPetState(event));
      this.#threadController.touch(event.threadId);
      this.#actualStates.set(event.threadId, event);
      this.#lastActiveThreadId = event.threadId;
      this.#applyRequestState(event.threadId);
      return;
    }
    if (event.type === "token-usage") {
      this.#threadController.touch(event.threadId);
      const usage = normalizeThreadTokenUsage(event.threadId, event.tokenUsage);
      if (usage) {
        this.#threadTokenUsage.set(event.threadId, usage);
        this.#lastActiveThreadId = event.threadId;
        this.#emit();
      }
      return;
    }
    if (event.type === "rate-limits" && this.#usageProvider) {
      void this.#refreshUsage(this.#usageProvider);
      return;
    }
    if (event.type === "approval-resolved") {
      this.#serverRequests.resolveFromServer(event.requestId);
      this.#handleServerRequestResolved(event.requestId);
      return;
    }
    if (event.type === "agent-message") {
      if (event.turnId) {
        const verification = this.#testTurns.get(event.turnId);
        if (verification?.kind === "steer" && event.containsSteered) {
          verification.containsSteered = true;
          this.#e2eStore.waitForCodex(verification.recordId, ["final-reply-steered"]);
        }
      }
      return;
    }
    if (event.type === "command-observed") {
      if (event.turnId) {
        const verification = this.#testTurns.get(event.turnId);
        if (verification) {
          verification.commandObserved = true;
          this.#e2eStore.waitForCodex(verification.recordId, ["item/commandExecution/started"]);
        }
      }
      return;
    }
    if (event.type === "turn-completed") {
      if (event.turnId) this.#serverRequests.clearByTurn(event.threadId, event.turnId);
      this.#threadController.markTurnCompleted(event.threadId, event.turnId);
      if (event.turnId) {
        const verification = this.#testTurns.get(event.turnId);
        if (verification) {
          verification.terminalStatus = event.terminalStatus;
          this.#finishVerification(event.turnId);
        }
      }
      this.#emit();
      return;
    }
    if (event.type === "thread-ended") {
      this.#threadTokenUsage.delete(event.threadId);
      this.#actualStates.delete(event.threadId);
      this.#serverRequests.clearByThread(event.threadId);
      this.#petStateMachine.remove(event.threadId);
      this.#threadController.remove(event.threadId);
      return;
    }
    if (event.type === "diagnostic")
      this.#logger.write("debug", event.code, { method: event.method });
  }

  #reconcileRequestStates(): void {
    const threadIds = new Set<string>([
      ...this.#actualStates.keys(),
      ...this.#approvalRouter.getQueue().map((request) => request.threadId),
      ...this.#inputRouter.snapshot().map((request) => request.threadId),
    ]);
    for (const threadId of threadIds) this.#applyRequestState(threadId);
    this.#emit();
  }

  #applyRequestState(threadId: string): void {
    this.#threadController.touch(threadId);
    const approval = this.#approvalRouter
      .getQueue()
      .some((request) => request.threadId === threadId);
    const input = this.#inputRouter.snapshot().some((request) => request.threadId === threadId);
    const actual = this.#actualStates.get(threadId);
    this.#petStateMachine.update({
      threadId,
      turnId: actual?.turnId,
      state: approval ? "approval" : input ? "waiting_input" : (actual?.state ?? "idle"),
      source: approval ? "approval-router" : input ? "input-router" : (actual?.source ?? "runtime"),
      timestamp: Date.now(),
      transientReturnState: actual?.transientReturnState,
    });
    this.#sessionRegistry.observe({
      providerId: "codex",
      sessionId: threadId,
      source: "codex-app-server",
      timestamp: Date.now(),
      turnId: actual?.turnId,
      event: approval ? "approval_required" : input ? "input_required" : "state_changed",
      state: approval ? "approval" : input ? "waiting_input" : undefined,
    });
    if (approval || input) this.#threadController.markWaiting(threadId);
    else if (actual?.state === "error") this.#threadController.markError(threadId);
  }

  #client() {
    const client = this.#appServer.client;
    if (!client) throw new Error("Codex App Server is not connected");
    return client;
  }

  #handleApprovalQueued(request: ApprovalRequest): void {
    this.#applyRequestState(request.threadId);
    const verification = request.turnId ? this.#testTurns.get(request.turnId) : undefined;
    if (
      verification &&
      (verification.kind === "approval-allow" || verification.kind === "approval-deny")
    ) {
      verification.requestId = request.requestId;
      this.#e2eStore.attach(verification.recordId, { requestId: request.requestId });
      this.#e2eStore.waitForUser(verification.recordId, "item/commandExecution/requestApproval");
      this.#emit();
    }
  }

  #handleInputQueued(request: UserInputRequest): void {
    this.#applyRequestState(request.threadId);
    const verification = request.turnId ? this.#testTurns.get(request.turnId) : undefined;
    if (verification?.kind === "user-input") {
      verification.requestId = request.requestId;
      this.#e2eStore.attach(verification.recordId, { requestId: request.requestId });
      this.#e2eStore.waitForUser(verification.recordId, "item/tool/requestUserInput");
      this.#emit();
    }
  }

  #handleServerRequestResolved(requestId: string): void {
    for (const [turnId, verification] of this.#testTurns) {
      if (verification.requestId !== requestId) continue;
      verification.serverResolved = true;
      this.#e2eStore.waitForCodex(verification.recordId, ["serverRequest/resolved"]);
      this.#finishVerification(turnId);
      break;
    }
  }

  #finishVerification(turnId: string): void {
    const verification = this.#testTurns.get(turnId);
    if (!verification?.terminalStatus) return;
    const terminalEvidence = ["turn/completed"];
    if (verification.kind === "approval-allow" || verification.kind === "approval-deny") {
      if (!verification.requestId)
        return this.#failVerification(
          turnId,
          verification.commandObserved ? "approval-not-requested" : "approval-command-not-observed",
          terminalEvidence,
        );
      if (!verification.responseReceived)
        return this.#failVerification(turnId, "approval-not-answered", terminalEvidence);
      if (!verification.serverResolved) return;
      return this.#passVerification(turnId, terminalEvidence);
    }
    if (verification.kind === "user-input") {
      if (!verification.requestId)
        return this.#failVerification(turnId, "user-input-not-requested", terminalEvidence);
      if (!verification.responseReceived)
        return this.#failVerification(turnId, "user-input-not-answered", terminalEvidence);
      if (!verification.serverResolved) return;
      return this.#passVerification(turnId, terminalEvidence);
    }
    if (verification.kind === "steer") {
      if (!verification.steerSent)
        return this.#failVerification(turnId, "turn-finished-before-steer", terminalEvidence);
      if (!verification.containsSteered)
        return this.#failVerification(turnId, "steer-evidence-missing", terminalEvidence);
      return this.#passVerification(turnId, terminalEvidence);
    }
    if (!verification.responseReceived)
      return this.#failVerification(turnId, "turn-finished-before-interrupt", terminalEvidence);
    if (
      verification.terminalStatus !== "interrupted" &&
      verification.terminalStatus !== "cancelled"
    )
      return this.#failVerification(turnId, "interrupt-not-observed", terminalEvidence);
    this.#passVerification(turnId, terminalEvidence);
  }

  #passVerification(turnId: string, evidence: string[]): void {
    const verification = this.#testTurns.get(turnId);
    if (!verification) return;
    this.#e2eStore.pass(verification.recordId, evidence);
    this.#testTurns.delete(turnId);
    this.#emit();
  }

  #failVerification(turnId: string, failureCode: string, evidence: string[]): void {
    const verification = this.#testTurns.get(turnId);
    if (!verification) return;
    this.#e2eStore.fail(verification.recordId, failureCode, evidence);
    this.#testTurns.delete(turnId);
    this.#emit();
  }

  #emit(): void {
    const now = Date.now();
    if (this.#lastActivitySampleAt !== undefined && this.#wasSessionActive) {
      const elapsed = Math.max(0, Math.min(90_000, now - this.#lastActivitySampleAt));
      if (elapsed) this.#onActiveInterval?.(elapsed, now);
    }
    this.#lastActivitySampleAt = now;
    this.#wasSessionActive =
      arbitrateSessionAttention(this.#sessionRegistry.getSnapshot(now)).concurrencyLevel > 0;
    this.#publishSnapshot(this.getSnapshot());
  }
}
