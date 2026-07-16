import { app, dialog } from "electron";
import { join } from "node:path";
import { SafeLogger } from "../core/logging/logger";
import type { PetState } from "../core/pet/pet-state";
import { IPC_CHANNELS } from "../shared/ipc-contract";
import { type LocalSettings } from "../shared/settings";
import { AppServerProcess } from "../core/codex/app-server-process";
import { registerIpcHandlers } from "./ipc-handlers";
import { HookEventBridge } from "./hook-event-bridge";
import { installCodexPetHooks } from "./hook-installer";
import { LocalSettingsStore } from "./position-store";
import { RuntimeController } from "./runtime-controller";
import { runSmokeValidation } from "./smoke-validation";
import { writeE2EResult } from "./e2e-result-writer";
import { TrayManager } from "./tray-manager";
import { windowModeForSnapshot } from "./window-layout";
import { WindowManager } from "./window-manager";

const logger = new SafeLogger();
let settingsStore: LocalSettingsStore;
let windowManager: WindowManager;
let trayManager: TrayManager;
let runtime: RuntimeController;
let hookBridge: HookEventBridge;
let hookEventsPath: string;

async function connectCodexHook(): Promise<void> {
  try {
    await installCodexPetHooks({
      hooksPath: join(app.getPath("home"), ".codex", "hooks.json"),
      receiverPath: join(__dirname, "../hook/codex-pet-hook.cjs"),
      eventPath: hookEventsPath,
    });
    await dialog.showMessageBox({
      type: "info",
      title: "Codex Hook installed",
      message: "Review is required before activity is connected.",
      detail:
        "Open /hooks in Codex, review this hook, and choose Trust. Codex requires that final trust step before the pet can receive activity.",
    });
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "Could not connect Codex activity",
      message: "The hook configuration was not changed.",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
let disposeIpc: (() => void) | undefined;

function rebuildTray(settings: LocalSettings): void {
  trayManager.create(settings, {
    showOrHide: () => windowManager.showOrHide(),
    toggleHud: () =>
      void runtime.patchSettings({ hudVisible: !runtime.getSnapshot().settings.hudVisible }),
    toggleDebug: () =>
      void runtime.patchSettings({ debugVisible: !runtime.getSnapshot().settings.debugVisible }),
    toggleAlwaysOnTop: () =>
      void runtime.patchSettings({ alwaysOnTop: !runtime.getSnapshot().settings.alwaysOnTop }),
    toggleClickThrough: () =>
      void runtime.patchSettings({ clickThrough: !runtime.getSnapshot().settings.clickThrough }),
    reconnectCodex: () => void runtime.reconnect().catch(() => undefined),
    connectCodexHook: () => void connectCodexHook(),
  });
}

async function startApplication(): Promise<void> {
  settingsStore = new LocalSettingsStore(join(app.getPath("userData"), "settings.json"));
  let settings = await settingsStore.read();
  const smokeOutput = process.env.CODEX_PET_SMOKE_OUTPUT;
  const smokeReal = process.env.CODEX_PET_SMOKE_REAL === "1";
  const smokeInputOnly = process.env.CODEX_PET_SMOKE_INPUT === "1";
  const smokeCompact = process.env.CODEX_PET_SMOKE_COMPACT === "1";
  const guidedE2E = process.argv.includes("--m2-6-e2e");
  const guidedE2EResult = join(process.cwd(), "tmp", "e2e", "results", "latest.json");
  if (guidedE2E) {
    settings = {
      ...settings,
      debugVisible: true,
      useMockData: false,
      autoStartAppServer: true,
      clickThrough: false,
    };
  }
  if (smokeOutput) {
    settings = {
      ...settings,
      hudVisible: !smokeCompact,
      debugVisible: !smokeCompact,
      useMockData: !smokeReal,
      autoStartAppServer: smokeReal,
      clickThrough: false,
    };
  }
  windowManager = new WindowManager(settingsStore);
  trayManager = new TrayManager();
  runtime = new RuntimeController({
    logger,
    initialSettings: settings,
    publish: (snapshot) => {
      windowManager.setMode(windowModeForSnapshot(snapshot));
      windowManager.send(IPC_CHANNELS.snapshot, snapshot);
      if (guidedE2E) {
        try {
          writeE2EResult(guidedE2EResult, snapshot);
        } catch (error) {
          logger.write("error", "e2e-result-write-failed", {
            errorName: error instanceof Error ? error.name : "unknown",
          });
        }
      }
    },
    persistSettings: (patch) => settingsStore.patch(patch),
    onSettingsChanged: (next) => {
      windowManager.setAlwaysOnTop(next.alwaysOnTop);
      windowManager.setClickThrough(next.clickThrough);
      rebuildTray(next);
    },
    createAppServer: guidedE2E
      ? (options) => new AppServerProcess({ ...options, safeVerificationDefaults: true })
      : undefined,
  });
  hookEventsPath = join(app.getPath("userData"), "hook-events.jsonl");
  hookBridge = new HookEventBridge(hookEventsPath, (event) => runtime.applyHookEvent(event));
  await windowManager.create(settings);
  hookBridge.start();
  rebuildTray(settings);
  disposeIpc = registerIpcHandlers({
    getSnapshot: () => runtime.getSnapshot(),
    setPetState: (state: PetState) => runtime.setDebugPetState(state),
    respondApproval: (requestId, decision) => runtime.respondApproval(requestId, decision),
    respondUserInput: (requestId, answers) => runtime.respondUserInput(requestId, answers),
    cancelUserInput: (requestId) => runtime.cancelUserInput(requestId),
    toggleHud: () =>
      runtime.patchSettings({ hudVisible: !runtime.getSnapshot().settings.hudVisible }),
    toggleDebug: () =>
      runtime.patchSettings({ debugVisible: !runtime.getSnapshot().settings.debugVisible }),
    toggleAlwaysOnTop: () =>
      runtime.patchSettings({ alwaysOnTop: !runtime.getSnapshot().settings.alwaysOnTop }),
    toggleClickThrough: () =>
      runtime.patchSettings({ clickThrough: !runtime.getSnapshot().settings.clickThrough }),
    reconnectCodex: () => runtime.reconnect(),
    patchSettings: (patch) => runtime.patchSettings(patch),
    enqueueMockApproval: () => runtime.enqueueMockApproval(),
    enqueueMockUserInput: () => runtime.enqueueMockUserInput(),
    createThread: (request) => runtime.createThread(request),
    startTurn: (request) => runtime.startTurn(request),
    steerTurn: (request) => runtime.steerTurn(request),
    interruptTurn: (request) => runtime.interruptTurn(request),
    selectThread: (threadId) => runtime.selectThread(threadId),
    runApprovalTest: () => runtime.runApprovalTest(),
    runUserInputTest: () => runtime.runUserInputTest(),
    startVerification: () => runtime.startVerification(),
    runVerification: (kind) => runtime.runVerification(kind),
  });
  await runtime.start();
  if (smokeOutput && !smokeReal && !smokeCompact) {
    if (smokeInputOnly) runtime.enqueueMockUserInput();
    else runtime.enqueueMockApproval();
  }
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
    hookBridge?.stop();
    trayManager?.destroy();
    void runtime
      ?.stop()
      .catch(() => undefined)
      .finally(() => {
        cleanupComplete = true;
        app.quit();
      });
  });
}
