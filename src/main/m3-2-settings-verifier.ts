import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { BrowserWindow } from "electron";

export type M32VerificationPhase = "import" | "restart";

export interface M32E2EConfiguration {
  phase: M32VerificationPhase;
  userDataDirectory: string;
  outputDirectory: string;
  importSource?: string;
}

export interface M32VerificationReport {
  phase: M32VerificationPhase;
  passed: boolean;
  packaged: boolean;
  currentPetId: string;
  availablePetIds: string[];
  previewsLoaded: boolean;
  imported: boolean;
  switchedToBuiltin: boolean;
  switchedBack: boolean;
  rescanned: boolean;
  screenshot: string;
  windowVisible?: boolean;
  windowBounds?: { x: number; y: number; width: number; height: number };
  error?: string;
}

interface SettingsDomState {
  currentPetId?: string;
  availablePetIds: string[];
  previewsLoaded: boolean;
  error?: string;
}

interface ScreenshotViewport {
  scrollY: number;
  petTop: number;
  petHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

const SETTINGS_STATE_SCRIPT = `(() => {
  const current = document.querySelector('[data-testid="current-pet"]');
  const images = [...document.querySelectorAll('.pet-selector img')];
  return {
    currentPetId: current?.getAttribute('data-pet-id') ?? undefined,
    availablePetIds: [...document.querySelectorAll('[data-testid="pet-card"]')]
      .map((card) => card.getAttribute('data-pet-id'))
      .filter(Boolean),
    previewsLoaded: images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0),
    error: document.querySelector('.settings-error')?.textContent ?? undefined,
  };
})()`;

function requiredAbsolutePath(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`${key} is required for M3.2 E2E`);
  if (!isAbsolute(value)) throw new Error(`${key} must be an absolute path`);
  return resolve(value);
}

export function parseM32E2EConfiguration(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): M32E2EConfiguration | undefined {
  if (!argv.includes("--m3-2-e2e")) return undefined;
  const phase = env.CODEX_PET_M3_2_PHASE;
  if (phase !== "import" && phase !== "restart")
    throw new Error("CODEX_PET_M3_2_PHASE must be import or restart");
  const configuration: M32E2EConfiguration = {
    phase,
    userDataDirectory: requiredAbsolutePath(env, "CODEX_PET_M3_2_USER_DATA"),
    outputDirectory: requiredAbsolutePath(env, "CODEX_PET_M3_2_OUTPUT"),
  };
  if (phase === "import")
    configuration.importSource = requiredAbsolutePath(env, "CODEX_PET_M3_2_IMPORT_SOURCE");
  return configuration;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("M3.2 report must be an object");
  return value as Record<string, unknown>;
}

function requireEvidence(value: Record<string, unknown>, key: string): void {
  if (value[key] !== true) throw new Error(`M3.2 report evidence failed: ${key}`);
}

export function validateM32VerificationReport(
  value: unknown,
  expectedPhase: M32VerificationPhase,
): M32VerificationReport {
  const report = record(value);
  if (report.phase !== expectedPhase) throw new Error("M3.2 report phase does not match");
  for (const key of ["passed", "packaged", "previewsLoaded"]) requireEvidence(report, key);
  if (report.currentPetId !== "e2e-sprout")
    throw new Error("M3.2 report did not retain e2e-sprout");
  if (
    !Array.isArray(report.availablePetIds) ||
    !report.availablePetIds.includes("pixel-sprout") ||
    !report.availablePetIds.includes("e2e-sprout")
  )
    throw new Error("M3.2 report is missing expected available pets");
  if (typeof report.screenshot !== "string" || !isAbsolute(report.screenshot))
    throw new Error("M3.2 report screenshot must be an absolute path");
  if (expectedPhase === "import") {
    for (const key of ["imported", "switchedToBuiltin", "switchedBack"])
      requireEvidence(report, key);
  } else requireEvidence(report, "rescanned");
  return report as unknown as M32VerificationReport;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function readSettingsState(window: BrowserWindow): Promise<SettingsDomState> {
  return window.webContents.executeJavaScript(SETTINGS_STATE_SCRIPT) as Promise<SettingsDomState>;
}

async function waitForSettingsState(
  window: BrowserWindow,
  predicate: (state: SettingsDomState) => boolean,
  label: string,
  timeoutMs = 15_000,
): Promise<SettingsDomState> {
  const deadline = Date.now() + timeoutMs;
  let last: SettingsDomState | undefined;
  while (Date.now() < deadline) {
    last = await readSettingsState(window);
    if (last.error) throw new Error(`Settings reported an error: ${last.error}`);
    if (predicate(last)) return last;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}; last state: ${JSON.stringify(last)}`);
}

async function click(window: BrowserWindow, testId: string): Promise<void> {
  const clicked = (await window.webContents.executeJavaScript(`(() => {
    const element = document.querySelector('[data-testid="${testId}"]');
    if (!(element instanceof HTMLButtonElement) || element.disabled) return false;
    element.click();
    return true;
  })()`)) as boolean;
  if (!clicked) throw new Error(`Could not click Settings control ${testId}`);
}

async function capturePetSection(
  window: BrowserWindow,
  viewport: ScreenshotViewport,
): Promise<Buffer> {
  const chromeDebugger = window.webContents.debugger;
  if (chromeDebugger.isAttached()) throw new Error("Settings debugger is already attached");
  chromeDebugger.attach("1.3");
  try {
    const result = (await chromeDebugger.sendCommand("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: viewport.scrollY + viewport.petTop,
        width: viewport.viewportWidth,
        height: Math.min(viewport.petHeight, viewport.viewportHeight),
        scale: 1,
      },
    })) as { data?: unknown };
    if (typeof result.data !== "string")
      throw new Error("Chromium did not return a Settings screenshot");
    return Buffer.from(result.data, "base64");
  } finally {
    if (chromeDebugger.isAttached()) chromeDebugger.detach();
  }
}

export async function runM32SettingsVerification(options: {
  configuration: M32E2EConfiguration;
  window: BrowserWindow;
  packaged: boolean;
}): Promise<M32VerificationReport> {
  const { configuration, window, packaged } = options;
  await mkdir(configuration.outputDirectory, { recursive: true });
  window.show();
  const screenshot = join(configuration.outputDirectory, `settings-${configuration.phase}.png`);
  const reportPath = join(configuration.outputDirectory, "report.json");
  const base = {
    phase: configuration.phase,
    packaged,
    imported: false,
    switchedToBuiltin: false,
    switchedBack: false,
    rescanned: false,
    screenshot,
  };

  try {
    const initial = await waitForSettingsState(
      window,
      (state) => Boolean(state.currentPetId),
      "the current pet",
    );
    let imported = false;
    let switchedToBuiltin = false;
    let switchedBack = false;
    let rescanned = false;

    if (configuration.phase === "import") {
      if (initial.currentPetId !== "pixel-sprout")
        throw new Error(
          `Import phase must start with pixel-sprout, received ${initial.currentPetId}`,
        );
      await click(window, "pet-import");
      await waitForSettingsState(
        window,
        (state) => state.currentPetId === "e2e-sprout",
        "the imported pet to become active",
      );
      imported = true;
      await click(window, "pet-select-pixel-sprout");
      await waitForSettingsState(
        window,
        (state) => state.currentPetId === "pixel-sprout",
        "the built-in pet switch",
      );
      switchedToBuiltin = true;
      await click(window, "pet-select-e2e-sprout");
      await waitForSettingsState(
        window,
        (state) => state.currentPetId === "e2e-sprout",
        "the imported pet switch",
      );
      switchedBack = true;
    } else {
      if (initial.currentPetId !== "e2e-sprout")
        throw new Error(`Restart phase did not restore e2e-sprout: ${initial.currentPetId}`);
      await click(window, "pet-rescan");
      await waitForSettingsState(
        window,
        (state) => state.currentPetId === "e2e-sprout",
        "the rescan to retain the active pet",
      );
      rescanned = true;
    }

    const finalState = await waitForSettingsState(
      window,
      (state) =>
        state.currentPetId === "e2e-sprout" &&
        state.availablePetIds.includes("pixel-sprout") &&
        state.availablePetIds.includes("e2e-sprout") &&
        state.previewsLoaded,
      "both loaded pet previews",
    );
    await delay(250);
    const screenshotViewport = (await window.webContents.executeJavaScript(
      `(async () => {
        document.documentElement.style.scrollBehavior = 'auto';
        const pets = document.querySelector('#pets');
        if (!(pets instanceof HTMLElement)) throw new Error('Pets section is unavailable');
        window.scrollTo(0, pets.offsetTop);
        await new Promise(requestAnimationFrame);
        window.scrollTo(0, pets.offsetTop);
        return {
          scrollY: window.scrollY,
          petTop: pets.getBoundingClientRect().top,
          petHeight: pets.getBoundingClientRect().height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
      })()`,
    )) as ScreenshotViewport;
    if (
      screenshotViewport.scrollY <= 0 ||
      screenshotViewport.petTop < -1 ||
      screenshotViewport.petTop >= screenshotViewport.viewportHeight
    )
      throw new Error(
        `Pets section is outside the screenshot viewport: ${JSON.stringify(screenshotViewport)}`,
      );
    await writeFile(screenshot, await capturePetSection(window, screenshotViewport));
    const report: M32VerificationReport = {
      ...base,
      passed: true,
      currentPetId: finalState.currentPetId!,
      availablePetIds: finalState.availablePetIds,
      previewsLoaded: finalState.previewsLoaded,
      imported,
      switchedToBuiltin,
      switchedBack,
      rescanned,
      windowVisible: window.isVisible(),
      windowBounds: window.getBounds(),
    };
    validateM32VerificationReport(report, configuration.phase);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return report;
  } catch (error) {
    const failed = {
      ...base,
      passed: false,
      currentPetId: "",
      availablePetIds: [],
      previewsLoaded: false,
      error: error instanceof Error ? error.message : "Unknown M3.2 Settings verification error",
    };
    await writeFile(reportPath, `${JSON.stringify(failed, null, 2)}\n`, "utf8");
    throw error;
  }
}
