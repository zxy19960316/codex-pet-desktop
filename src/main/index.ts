import { app } from "electron";
import { join } from "node:path";
import {
  ApprovalRouter,
  buildApprovalResponse,
  type ApprovalRequest,
} from "../core/codex/approval-router";
import { AppServerProcess, type AppServerStatus } from "../core/codex/app-server-process";
import { EventNormalizer } from "../core/codex/event-normalizer";
import type { JsonRpcClient } from "../core/codex/json-rpc-client";
import {
  CodexUsageProvider,
  MockUsageProvider,
  type UsageProvider,
} from "../core/codex/usage-provider";
import { SafeLogger } from "../core/logging/logger";
import { PetStateMachine } from "../core/pet/state-machine";
import type { PetState } from "../core/pet/pet-state";
import { IPC_CHANNELS, type DesktopSnapshot } from "../shared/ipc-contract";
import { DEFAULT_SETTINGS, type LocalSettings } from "../shared/settings";
import { registerIpcHandlers } from "./ipc-handlers";
import { LocalSettingsStore } from "./position-store";
import { runSmokeValidation } from "./smoke-validation";
import { TrayManager } from "./tray-manager";
import { WindowManager } from "./window-manager";

interface PendingApproval {
  request: ApprovalRequest;
  resolve: (value: unknown) => void;
}

const logger = new SafeLogger();
const normalizer = new EventNormalizer();
const pendingApprovals = new Map<string, PendingApproval>();
let settingsStore: LocalSettingsStore;
let windowManager: WindowManager;
let trayManager: TrayManager;
let settings: LocalSettings = { ...DEFAULT_SETTINGS };
let usageProvider: UsageProvider | undefined;
let disposeIpc: (() => void) | undefined;

let snapshot: DesktopSnapshot = {
  connectionStatus: "stopped",
  petState: "idle",
  threadStates: [],
  activeThreadCount: 0,
  currentCwd: process.cwd(),
  approvals: [],
  rateLimits: null,
  dailyUsage: null,
  currentThreadTokens: null,
  settings,
  protocolSource: "unavailable",
};

function publish(patch: Partial<DesktopSnapshot> = {}): void {
  snapshot = { ...snapshot, ...patch, settings };
  windowManager?.send(IPC_CHANNELS.snapshot, snapshot);
}

const petStateMachine = new PetStateMachine({
  onChange: (petState) => {
    publish({
      petState,
      threadStates: petStateMachine.snapshot(),
      activeThreadCount: petStateMachine.getActiveThreadCount(),
    });
  },
});

const approvalRouter = new ApprovalRouter({
  onChange: (approvals) => publish({ approvals }),
  respond: async (requestId, decision, request) => {
    const pending = pendingApprovals.get(requestId);
    if (!pending) {
      if (requestId.startsWith("mock-")) return;
      throw new Error("The App Server request is no longer pending");
    }
    pendingApprovals.delete(requestId);
    pending.resolve(buildApprovalResponse(decision, request));
  },
});

function updateStatus(connectionStatus: AppServerStatus, connectionDetail?: string): void {
  publish({ connectionStatus, connectionDetail });
}

async function refreshUsage(provider: UsageProvider): Promise<void> {
  const [limits, daily] = await Promise.allSettled([
    provider.readRateLimits(),
    provider.readDailyUsage(),
  ]);
  publish({
    rateLimits: limits.status === "fulfilled" ? limits.value : null,
    dailyUsage: daily.status === "fulfilled" ? daily.value : null,
  });
}

function applyNotification(method: string, params: unknown): void {
  for (const event of normalizer.normalizeNotification(method, params)) {
    if (event.type === "pet-state") petStateMachine.update({ ...event });
    else if (event.type === "token-usage") {
      const usage =
        event.tokenUsage && typeof event.tokenUsage === "object"
          ? (event.tokenUsage as Record<string, unknown>)
          : {};
      const total =
        usage.total && typeof usage.total === "object"
          ? (usage.total as Record<string, unknown>)
          : {};
      publish({
        currentThreadTokens: typeof total.totalTokens === "number" ? total.totalTokens : null,
      });
    } else if (event.type === "rate-limits" && usageProvider) void refreshUsage(usageProvider);
    else if (event.type === "approval-resolved") {
      const pending = pendingApprovals.get(event.requestId);
      if (pending) {
        pendingApprovals.delete(event.requestId);
        pending.resolve(buildApprovalResponse("cancel", pending.request));
      }
      approvalRouter.resolve(event.requestId);
    } else if (event.type === "diagnostic")
      logger.write("debug", event.code, { method: event.method });
  }
}

const appServer = new AppServerProcess({
  onStatus: updateStatus,
  onNotification: applyNotification,
  onDiagnostic: (code) => logger.write("debug", code),
  onClient: (client) => {
    registerServerRequests(client);
    usageProvider = new CodexUsageProvider(client);
    void refreshUsage(usageProvider);
    publish({ protocolSource: "codex-app-server" });
  },
});

function registerServerRequests(client: JsonRpcClient): void {
  for (const method of [
    "item/commandExecution/requestApproval",
    "item/fileChange/requestApproval",
    "item/permissions/requestApproval",
  ]) {
    client.onServerRequest(method, (params, id) => {
      const request = approvalRouter.enqueue(id, method, params);
      petStateMachine.update({
        state: "approval",
        threadId: request.threadId,
        turnId: request.turnId,
        source: `codex:${method}`,
        timestamp: Date.now(),
      });
      return new Promise((resolve) =>
        pendingApprovals.set(request.requestId, { request, resolve }),
      );
    });
  }
  client.onServerRequest("item/tool/requestUserInput", (params) => {
    const value = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
    petStateMachine.update({
      state: "waiting_input",
      threadId: typeof value.threadId === "string" ? value.threadId : "unknown",
      turnId: typeof value.turnId === "string" ? value.turnId : undefined,
      source: "codex:item/tool/requestUserInput",
      timestamp: Date.now(),
    });
    throw new Error("User-input replies are planned for M2");
  });
}

async function connectCodex(): Promise<void> {
  if (settings.useMockData) {
    await appServer.stop();
    usageProvider = new MockUsageProvider();
    await refreshUsage(usageProvider);
    publish({
      connectionStatus: "stopped",
      connectionDetail: "Mock data enabled",
      protocolSource: "mock",
    });
    return;
  }
  publish({ protocolSource: "unavailable", rateLimits: null, dailyUsage: null });
  try {
    await appServer.start();
  } catch (error) {
    logger.write("warn", "app-server-connect-failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    publish({
      protocolSource: "unavailable",
      connectionDetail: "App Server unavailable; enable Mock data in debug controls",
    });
  }
}

function safeSettingsPatch(patch: Partial<LocalSettings>): Partial<LocalSettings> {
  const safe: Partial<LocalSettings> = {};
  for (const key of [
    "alwaysOnTop",
    "clickThrough",
    "hudVisible",
    "debugVisible",
    "useMockData",
    "autoStartAppServer",
    "soundEnabled",
  ] as const) {
    if (typeof patch[key] === "boolean") safe[key] = patch[key];
  }
  if (typeof patch.quotaWarningPercent === "number")
    safe.quotaWarningPercent = patch.quotaWarningPercent;
  return safe;
}

async function patchSettings(patch: Partial<LocalSettings>): Promise<void> {
  settings = await settingsStore.patch(safeSettingsPatch(patch));
  windowManager.setAlwaysOnTop(settings.alwaysOnTop);
  windowManager.setClickThrough(settings.clickThrough);
  rebuildTray();
  publish();
  if ("useMockData" in patch || "autoStartAppServer" in patch) await connectCodex();
}

function enqueueMockApproval(): void {
  approvalRouter.enqueue(`mock-${Date.now()}`, "item/commandExecution/requestApproval", {
    threadId: "mock-thread",
    turnId: "mock-turn",
    itemId: "mock-item",
    reason: "Mock-only route and UI verification",
    command: "npm test -- --runInBand --example-only",
    cwd: "sample/project",
    availableDecisions: ["accept", "decline", "cancel"],
    autoResolutionMs: 60_000,
  });
}

function rebuildTray(): void {
  trayManager.create(settings, {
    showOrHide: () => windowManager.showOrHide(),
    toggleHud: () => void patchSettings({ hudVisible: !settings.hudVisible }),
    toggleDebug: () => void patchSettings({ debugVisible: !settings.debugVisible }),
    toggleAlwaysOnTop: () => void patchSettings({ alwaysOnTop: !settings.alwaysOnTop }),
    toggleClickThrough: () => void patchSettings({ clickThrough: !settings.clickThrough }),
    reconnectCodex: () => void appServer.reconnect().catch(() => undefined),
  });
}

async function startApplication(): Promise<void> {
  settingsStore = new LocalSettingsStore(join(app.getPath("userData"), "settings.json"));
  settings = await settingsStore.read();
  const smokeOutput = process.env.CODEX_PET_SMOKE_OUTPUT;
  const smokeReal = process.env.CODEX_PET_SMOKE_REAL === "1";
  if (smokeOutput) {
    settings = {
      ...settings,
      hudVisible: true,
      debugVisible: true,
      useMockData: !smokeReal,
      autoStartAppServer: smokeReal,
      clickThrough: false,
    };
  }
  windowManager = new WindowManager(settingsStore);
  trayManager = new TrayManager();
  await windowManager.create(settings);
  rebuildTray();
  disposeIpc = registerIpcHandlers({
    getSnapshot: () => snapshot,
    setPetState: (state: PetState) =>
      petStateMachine.update({
        state,
        threadId: "debug",
        source: "debug-panel",
        timestamp: Date.now(),
      }),
    respondApproval: (requestId, decision) => approvalRouter.respond(requestId, decision),
    toggleHud: () => patchSettings({ hudVisible: !settings.hudVisible }),
    toggleDebug: () => patchSettings({ debugVisible: !settings.debugVisible }),
    toggleAlwaysOnTop: () => patchSettings({ alwaysOnTop: !settings.alwaysOnTop }),
    toggleClickThrough: () => patchSettings({ clickThrough: !settings.clickThrough }),
    reconnectCodex: async () => {
      await appServer.reconnect();
    },
    patchSettings,
    enqueueMockApproval,
  });
  if (smokeOutput && !smokeReal) enqueueMockApproval();
  publish({ settings, currentCwd: process.cwd() });
  if (settings.autoStartAppServer || settings.useMockData) void connectCodex();
  if (smokeOutput && windowManager.window) {
    void runSmokeValidation({
      outputDirectory: smokeOutput,
      window: windowManager.window,
      trayCreated: trayManager.isCreated,
      captureScreenshot: !smokeReal,
      settleMilliseconds: smokeReal ? 3_000 : 750,
    }).catch((error) => {
      logger.write("error", "smoke-validation-failed", {
        errorName: error instanceof Error ? error.name : "unknown",
      });
      app.quit();
    });
  }
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.setName("Codex Pet Desktop");
  app.setAboutPanelOptions({
    applicationName: "Codex Pet Desktop",
    applicationVersion: "0.1.0",
    copyright: "MIT licensed independent project",
  });
  app.on("second-instance", () => windowManager?.focus());
  app
    .whenReady()
    .then(startApplication)
    .catch((error) => {
      logger.write("error", "startup-failed", {
        errorName: error instanceof Error ? error.name : "unknown",
      });
      app.quit();
    });
  app.on("window-all-closed", () => undefined);
  let cleanupComplete = false;
  let cleanupStarted = false;
  app.on("before-quit", (event) => {
    if (cleanupComplete) return;
    event.preventDefault();
    if (cleanupStarted) return;
    cleanupStarted = true;
    disposeIpc?.();
    trayManager?.destroy();
    approvalRouter.dispose();
    petStateMachine.dispose();
    void Promise.allSettled([usageProvider?.stop(), appServer.stop()]).finally(() => {
      cleanupComplete = true;
      app.quit();
    });
  });
}
