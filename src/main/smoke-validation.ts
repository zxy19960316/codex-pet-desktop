import { app, type BrowserWindow } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PET_STATES } from "../core/pet/pet-state";

export interface SmokeValidationOptions {
  outputDirectory: string;
  window: BrowserWindow;
  trayCreated: boolean;
  captureScreenshot?: boolean;
  settleMilliseconds?: number;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runSmokeValidation(options: SmokeValidationOptions): Promise<void> {
  await mkdir(options.outputDirectory, { recursive: true });
  await delay(options.settleMilliseconds ?? 750);
  const dom = (await options.window.webContents.executeJavaScript(`({
    hud: Boolean(document.querySelector('[aria-label="Codex usage HUD"]')),
    debug: Boolean(document.querySelector('[aria-label="Debug controls"]')),
    developerControls: Boolean(document.querySelector('[aria-label="Developer controls"]')),
    approval: Boolean(document.querySelector('[aria-label="Approval request"]')),
    userInput: Boolean(document.querySelector('[aria-label="User input request"]')),
    connected: Boolean(document.querySelector('.connection--connected')),
    stateButtons: document.querySelectorAll('[aria-label="Debug controls"] .state-grid button').length,
    draggableShell: getComputedStyle(document.querySelector('.shell')).getPropertyValue('-webkit-app-region')
  })`)) as Record<string, unknown>;
  const reportPath = join(options.outputDirectory, "desktop-smoke.json");
  if (options.captureScreenshot !== false) {
    const screenshot = await options.window.webContents.capturePage();
    const screenshotPath = join(options.outputDirectory, "desktop-smoke.png");
    await writeFile(screenshotPath, screenshot.toPNG());
  }
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        window: {
          visible: options.window.isVisible(),
          alwaysOnTop: options.window.isAlwaysOnTop(),
          skipTaskbar: true,
          frameless: true,
          transparent: true,
        },
        trayCreated: options.trayCreated,
        expectedStateButtons: PET_STATES.length,
        screenshotCaptured: options.captureScreenshot !== false,
        dom,
        gracefulQuitRequested: true,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  app.quit();
}
