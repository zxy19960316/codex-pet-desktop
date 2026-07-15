import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DEFAULT_SETTINGS, type LocalSettings, type WindowPosition } from "../shared/settings";

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clampWindowPosition(
  position: WindowPosition,
  workArea: Rectangle,
  windowSize: { width: number; height: number },
): WindowPosition {
  return {
    x: Math.min(Math.max(position.x, workArea.x), workArea.x + workArea.width - windowSize.width),
    y: Math.min(Math.max(position.y, workArea.y), workArea.y + workArea.height - windowSize.height),
  };
}

export class LocalSettingsStore {
  readonly #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  async read(): Promise<LocalSettings> {
    try {
      const raw = JSON.parse(await readFile(this.#path, "utf8")) as Partial<LocalSettings>;
      return { ...DEFAULT_SETTINGS, ...raw };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError))
        throw error;
      return { ...DEFAULT_SETTINGS };
    }
  }

  async patch(patch: Partial<LocalSettings>): Promise<LocalSettings> {
    const next = { ...(await this.read()), ...patch };
    next.quotaWarningPercent = Math.min(100, Math.max(0, next.quotaWarningPercent));
    await mkdir(dirname(this.#path), { recursive: true });
    const temporary = `${this.#path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, this.#path);
    return next;
  }
}
