import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { join } from "node:path";
import { SafeLogger } from "../core/logging/logger";
import type { PetState } from "../core/pet/pet-state";
import { PetRegistry } from "../core/pet/pet-registry";
import { CodexPokePetsAdapter } from "../core/pet/adapters/codex-pokepets-adapter";
import { CodexPokePetsProvider } from "../core/pet/codex-pokepets-provider";
import { IPC_CHANNELS, type DesktopSnapshot } from "../shared/ipc-contract";
import { SETTINGS_IPC_CHANNELS, type SettingsWindowSnapshot } from "../shared/ipc/settings-ipc";
import { settingsDocumentFromLocalSettings, type LocalSettings } from "../shared/settings";
import { AppServerProcess } from "../core/codex/app-server-process";
import { registerIpcHandlers } from "./ipc-handlers";
import { HookEventBridge } from "./hook-event-bridge";
import { installCodexPetHooks } from "./hook-installer";
import { RuntimeController } from "./runtime-controller";
import { registerSettingsIpcHandlers } from "./settings/settings-ipc-handlers";
import { SettingsService } from "./settings/settings-service";
import { SettingsStore } from "./settings/settings-store";
import { runSmokeValidation } from "./smoke-validation";
import { writeE2EResult } from "./e2e-result-writer";
import { TrayManager } from "./tray-manager";
import { windowModeForSnapshot } from "./window-layout";
import { WindowManager } from "./window-manager";
import { SettingsWindowManager } from "./windows/settings-window-manager";
import { resolveBuiltinPetsDirectory } from "./pet-resource-path";
import { parseM32E2EConfiguration, runM32SettingsVerification } from "./m3-2-settings-verifier";

const logger = new SafeLogger();
const m32E2E = parseM32E2EConfiguration(process.argv, process.env);
if (m32E2E) app.setPath("userData", m32E2E.userDataDirectory);
let settingsService: SettingsService;
let windowManager: WindowManager;
let settingsWindowManager: SettingsWindowManager;
let trayManager: TrayManager;
let runtime: RuntimeController;
let hookBridge: HookEventBridge;
let hookEventsPath: string;
let petRegistry: PetRegistry;
let codexPokePetsAdapter: CodexPokePetsAdapter;
let codexPokePetsProvider: CodexPokePetsProvider;

async function confirmThirdPartyImport(): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: "warning",
    title: "Import third-party character asset",
    message:
      "Third-party character assets remain subject to their original rights and are not covered by this application's MIT license.",
    detail:
      "The selected local files will be copied only into this application's managed user-data pet directory. They will not be uploaded or added to the application installer.",
    buttons: ["Import", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  return result.response === 0;
}

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
let disposeSettingsIpc: (() => void) | undefined;

function buildSettingsSnapshot(snapshot: DesktopSnapshot): SettingsWindowSnapshot {
  return {
    settings: settingsDocumentFromLocalSettings(snapshot.settings),
    loadState: settingsService.getLoadState(),
    status: {
      connectionStatus: snapshot.connectionStatus,
      connectionDetail: snapshot.connectionDetail,
      protocolSource: snapshot.protocolSource,
      activeThreadCount: snapshot.activeThreadCount,
    },
    quota: {
      rateLimits: snapshot.rateLimits,
      dailyUsage: snapshot.dailyUsage,
      currentThreadTokens: snapshot.currentThreadTokens,
    },
    app: {
      name: app.getName(),
      version: app.getVersion(),
    },
    pets: snapshot.pet ?? petRegistry.getSnapshot(),
    codexPokePets: codexPokePetsProvider.getSnapshot(),
  };
}

function withPetSnapshot(snapshot: DesktopSnapshot): DesktopSnapshot {
  return { ...snapshot, pet: petRegistry.getSnapshot() };
}

function publishPetSnapshots(): void {
  const snapshot = withPetSnapshot(runtime.getSnapshot());
  windowManager.send(IPC_CHANNELS.snapshot, snapshot);
  settingsWindowManager.send(SETTINGS_IPC_CHANNELS.snapshot, buildSettingsSnapshot(snapshot));
}

function rebuildTray(settings: LocalSettings): void {
  trayManager.create(settings, {
    showOrHide: () => windowManager.showOrHide(),
    openSettings: () => void settingsWindowManager.open(),
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
  const userData = app.getPath("userData");
  petRegistry = new PetRegistry({
    builtinDirectory: resolveBuiltinPetsDirectory({
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      isPackaged: app.isPackaged,
    }),
    userDirectory: join(userData, "pets"),
    activePetId: "pixel-sprout",
  });
  await petRegistry.scan();
  codexPokePetsAdapter = new CodexPokePetsAdapter(petRegistry);
  codexPokePetsProvider = new CodexPokePetsProvider({
    sourceDirectory: join(app.getPath("home"), ".codex", "pets"),
    registry: petRegistry,
    adapter: codexPokePetsAdapter,
  });
  await codexPokePetsProvider.scan();
  settingsService = new SettingsService(
    new SettingsStore({
      legacyPath: join(userData, "settings.json"),
      v2Path: join(userData, "settings.v2.json"),
    }),
  );
  let settings = await settingsService.initialize();
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
  if (m32E2E) {
    settings = {
      ...settings,
      useMockData: true,
      autoStartAppServer: false,
      clickThrough: false,
    };
  }
  windowManager = new WindowManager(settingsService);
  settingsWindowManager = new SettingsWindowManager({
    preloadPath: join(__dirname, "../preload/settings.cjs"),
    htmlPath: join(__dirname, "../renderer/settings.html"),
    createWindow: (options) => new BrowserWindow(options),
  });
  trayManager = new TrayManager();
  runtime = new RuntimeController({
    logger,
    initialSettings: settings,
    publish: (snapshot) => {
      const publicSnapshot = withPetSnapshot(snapshot);
      windowManager.setMode(windowModeForSnapshot(publicSnapshot));
      windowManager.send(IPC_CHANNELS.snapshot, publicSnapshot);
      settingsWindowManager.send(
        SETTINGS_IPC_CHANNELS.snapshot,
        buildSettingsSnapshot(publicSnapshot),
      );
      if (guidedE2E) {
        try {
          writeE2EResult(guidedE2EResult, publicSnapshot);
        } catch (error) {
          logger.write("error", "e2e-result-write-failed", {
            errorName: error instanceof Error ? error.name : "unknown",
          });
        }
      }
    },
    persistSettings: (patch) => settingsService.patch(patch),
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
  disposeSettingsIpc = registerSettingsIpcHandlers(
    {
      handle: (channel, listener) =>
        ipcMain.handle(channel, (event, ...args) => listener(event, ...args)),
      removeHandler: (channel) => ipcMain.removeHandler(channel),
    },
    {
      getSnapshot: () => buildSettingsSnapshot(withPetSnapshot(runtime.getSnapshot())),
      patchSettings: (patch) => runtime.patchSettings(patch),
      getSettingsSenderId: () => settingsWindowManager.senderId,
      setActivePet: async (id) => {
        await petRegistry.setActivePet(id);
        publishPetSnapshots();
      },
      importPetPackage: async () => {
        const selection =
          m32E2E?.phase === "import" && m32E2E.importSource
            ? { canceled: false, filePaths: [m32E2E.importSource] }
            : await dialog.showOpenDialog({
                title: "Import Pet Package",
                properties: ["openDirectory"],
              });
        if (selection.canceled || !selection.filePaths[0]) return;
        const imported = await petRegistry.importPetPackage(selection.filePaths[0]);
        await petRegistry.setActivePet(imported.manifest.id);
        publishPetSnapshots();
      },
      importCodexPokePet: async () => {
        const selection = await dialog.showOpenDialog({
          title: "Import Codex PokéPet",
          properties: ["openDirectory"],
        });
        if (selection.canceled || !selection.filePaths[0]) return;
        const source = await codexPokePetsAdapter.inspect(selection.filePaths[0]);
        if (!(await confirmThirdPartyImport())) return;
        await codexPokePetsAdapter.import(source);
        await codexPokePetsProvider.scan();
        publishPetSnapshots();
      },
      scanCodexPokePets: async () => {
        await codexPokePetsProvider.scan();
        publishPetSnapshots();
      },
      importDiscoveredCodexPokePet: async (sourcePetId) => {
        if (!(await confirmThirdPartyImport())) return;
        await codexPokePetsProvider.import(sourcePetId);
        publishPetSnapshots();
      },
      rescanPets: async () => {
        await petRegistry.scan();
        await codexPokePetsProvider.scan();
        publishPetSnapshots();
      },
      openPetsDirectory: async () => {
        const error = await shell.openPath(petRegistry.userDirectory);
        if (error) throw new Error(`Could not open the pet directory: ${error}`);
      },
    },
  );
  await runtime.start();
  if (m32E2E) {
    const settingsWindow = (await settingsWindowManager.open()) as unknown as BrowserWindow;
    void runM32SettingsVerification({
      configuration: m32E2E,
      window: settingsWindow,
      packaged: app.isPackaged,
    })
      .catch((error) => {
        process.exitCode = 1;
        logger.write("error", "m3-2-settings-verification-failed", {
          errorName: error instanceof Error ? error.name : "unknown",
        });
      })
      .finally(() => app.quit());
  }
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
    disposeSettingsIpc?.();
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
