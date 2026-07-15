import { ApprovalRouter, type ApprovalDecision } from "../core/codex/approval-router";
import {
  AppServerProcess,
  type AppServerProcessOptions,
  type AppServerStatus,
} from "../core/codex/app-server-process";
import { EventNormalizer, type DomainEvent } from "../core/codex/event-normalizer";
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
import { SafeLogger } from "../core/logging/logger";
import { PetStateMachine } from "../core/pet/state-machine";
import type { PetState, PetStateChange } from "../core/pet/pet-state";
import { type DesktopSnapshot } from "../shared/ipc-contract";
import { DEFAULT_SETTINGS, type LocalSettings } from "../shared/settings";

export interface RuntimeControllerOptions {
  logger: SafeLogger;
  initialSettings: LocalSettings;
  publish: (snapshot: DesktopSnapshot) => void;
  persistSettings?: (patch: Partial<LocalSettings>) => Promise<LocalSettings>;
  onSettingsChanged?: (settings: LocalSettings) => void;
  createAppServer?: (options: AppServerProcessOptions) => AppServerProcess;
}

const BOOLEAN_SETTINGS = [
  "alwaysOnTop",
  "clickThrough",
  "hudVisible",
  "debugVisible",
  "useMockData",
  "autoStartAppServer",
  "soundEnabled",
] as const;

function safeSettingsPatch(patch: Partial<LocalSettings>): Partial<LocalSettings> {
  const safe: Partial<LocalSettings> = {};
  for (const key of BOOLEAN_SETTINGS) if (typeof patch[key] === "boolean") safe[key] = patch[key];
  if (typeof patch.quotaWarningPercent === "number" && Number.isFinite(patch.quotaWarningPercent))
    safe.quotaWarningPercent = patch.quotaWarningPercent;
  return safe;
}

export class RuntimeController {
  readonly #logger: SafeLogger;
  readonly #publishSnapshot: RuntimeControllerOptions["publish"];
  readonly #persistSettings?: RuntimeControllerOptions["persistSettings"];
  readonly #onSettingsChanged?: RuntimeControllerOptions["onSettingsChanged"];
  readonly #normalizer = new EventNormalizer();
  readonly #actualStates = new Map<string, PetStateChange>();
  readonly #threadTokenUsage = new Map<string, ThreadTokenUsage>();
  readonly #petStateMachine: PetStateMachine;
  readonly #approvalRouter: ApprovalRouter;
  readonly #inputRouter: InputRouter;
  readonly #serverRequests: ServerRequestRegistry;
  readonly #appServer: AppServerProcess;
  #settings: LocalSettings;
  #usageProvider?: UsageProvider;
  #rateLimits: RateLimitBucket[] | null = null;
  #dailyUsage: DailyUsage | null = null;
  #connectionStatus: AppServerStatus = "stopped";
  #connectionDetail?: string;
  #protocolSource: DesktopSnapshot["protocolSource"] = "unavailable";
  #selectedThreadId?: string;
  #lastActiveThreadId?: string;
  #mockInputIndex = 0;

  constructor(options: RuntimeControllerOptions) {
    this.#logger = options.logger;
    this.#settings = { ...DEFAULT_SETTINGS, ...options.initialSettings };
    this.#publishSnapshot = options.publish;
    this.#persistSettings = options.persistSettings;
    this.#onSettingsChanged = options.onSettingsChanged;
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
      onApprovalQueued: (request) => this.#applyRequestState(request.threadId),
      onInputQueued: (request) => this.#applyRequestState(request.threadId),
      onApprovalDiagnostic: (diagnostic) =>
        this.#logger.write("debug", "approval-request", diagnostic),
    });
    const createAppServer = options.createAppServer ?? ((config) => new AppServerProcess(config));
    this.#appServer = createAppServer({
      onStatus: (status, detail) => this.#updateStatus(status, detail),
      onNotification: (method, params) => this.#applyNotification(method, params),
      onDiagnostic: (code) => this.#logger.write("debug", code),
      onClient: (client) => {
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
    this.#serverRequests.clearAll("Application shutdown");
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
    this.#serverRequests.clearAll("App Server reconnecting");
    await this.#appServer.reconnect();
  }

  getSnapshot(): DesktopSnapshot {
    const selected = this.#selectedThreadId ?? this.#lastActiveThreadId;
    const current = selected ? (this.#threadTokenUsage.get(selected)?.totalTokens ?? null) : null;
    return {
      connectionStatus: this.#connectionStatus,
      connectionDetail: this.#connectionDetail,
      petState: this.#petStateMachine.getGlobalState(),
      threadStates: this.#petStateMachine.snapshot(),
      activeThreadCount: this.#petStateMachine.getActiveThreadCount(),
      currentCwd: process.cwd(),
      approvals: this.#approvalRouter.getQueue(),
      userInputs: this.#inputRouter.snapshot(),
      rateLimits: this.#rateLimits,
      dailyUsage: this.#dailyUsage,
      threadTokenUsage: [...this.#threadTokenUsage.values()].map((usage) => ({ ...usage })),
      selectedThreadId: this.#selectedThreadId,
      currentThreadTokens: current,
      settings: { ...this.#settings },
      protocolSource: this.#protocolSource,
    };
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

  async respondApproval(requestId: string, decision: ApprovalDecision): Promise<void> {
    await this.#approvalRouter.respond(requestId, decision);
  }

  async respondUserInput(requestId: string, answers: UserInputAnswers): Promise<void> {
    await this.#inputRouter.respond(requestId, answers);
  }

  async cancelUserInput(requestId: string): Promise<void> {
    await this.#inputRouter.cancel(requestId);
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

  setSelectedThreadId(threadId: string | undefined): void {
    this.#selectedThreadId = threadId;
    this.#emit();
  }

  async #connectCodex(): Promise<void> {
    if (this.#settings.useMockData) {
      await this.#appServer.stop();
      this.#serverRequests.clearAll("Mock mode enabled");
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
    if (status === "error") this.#serverRequests.clearAll("App Server disconnected");
    this.#emit();
  }

  #applyNotification(method: string, params: unknown): void {
    for (const event of this.#normalizer.normalizeNotification(method, params))
      this.#applyEvent(event);
  }

  #applyEvent(event: DomainEvent): void {
    if (event.type === "pet-state") {
      this.#actualStates.set(event.threadId, event);
      this.#lastActiveThreadId = event.threadId;
      this.#applyRequestState(event.threadId);
      return;
    }
    if (event.type === "token-usage") {
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
      return;
    }
    if (event.type === "turn-completed") {
      if (event.turnId) this.#serverRequests.clearByTurn(event.threadId, event.turnId);
      return;
    }
    if (event.type === "thread-ended") {
      this.#threadTokenUsage.delete(event.threadId);
      this.#actualStates.delete(event.threadId);
      this.#serverRequests.clearByThread(event.threadId);
      this.#petStateMachine.remove(event.threadId);
      if (this.#selectedThreadId === event.threadId) this.#selectedThreadId = undefined;
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
    });
  }

  #emit(): void {
    this.#publishSnapshot(this.getSnapshot());
  }
}
