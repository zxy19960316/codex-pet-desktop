import {
  cloneSettingsDocument,
  DEFAULT_SETTINGS,
  localSettingsFromDocument,
  settingsDocumentFromLocalSettings,
  type LocalSettings,
  type SettingsDocumentV2,
  type SettingsLoadState,
} from "../../shared/settings";
import { SettingsStore } from "./settings-store";

type SettingsListener = (settings: LocalSettings) => void;

function cloneLocalSettings(settings: Readonly<LocalSettings>): LocalSettings {
  return {
    ...settings,
    petPosition: settings.petPosition ? { ...settings.petPosition } : undefined,
  };
}

function applyPatch(current: LocalSettings, patch: Partial<LocalSettings>): LocalSettings {
  const next = cloneLocalSettings(current);
  const booleanKeys = [
    "alwaysOnTop",
    "clickThrough",
    "hudVisible",
    "debugVisible",
    "useMockData",
    "autoStartAppServer",
    "soundEnabled",
  ] as const;
  for (const key of booleanKeys) if (typeof patch[key] === "boolean") next[key] = patch[key];
  if (typeof patch.layoutVersion === "number" && Number.isInteger(patch.layoutVersion))
    next.layoutVersion = patch.layoutVersion;
  if (
    patch.petPosition &&
    Number.isFinite(patch.petPosition.x) &&
    Number.isFinite(patch.petPosition.y)
  )
    next.petPosition = { ...patch.petPosition };
  if (typeof patch.quotaWarningPercent === "number" && Number.isFinite(patch.quotaWarningPercent))
    next.quotaWarningPercent = Math.min(100, Math.max(0, patch.quotaWarningPercent));
  return next;
}

export class SettingsService {
  readonly #store: SettingsStore;
  readonly #listeners = new Set<SettingsListener>();
  #document = settingsDocumentFromLocalSettings({ ...DEFAULT_SETTINGS });
  #loadState: SettingsLoadState = { kind: "missing" };
  #writable = true;
  #initialized = false;
  #pending: Promise<void> = Promise.resolve();

  constructor(store: SettingsStore) {
    this.#store = store;
  }

  async initialize(): Promise<LocalSettings> {
    if (!this.#initialized) {
      const result = await this.#store.read();
      this.#document = cloneSettingsDocument(result.document);
      this.#loadState = { ...result.loadState };
      this.#writable = result.writable;
      this.#initialized = true;
    }
    return this.getSettings();
  }

  getSettings(): LocalSettings {
    return cloneLocalSettings(localSettingsFromDocument(this.#document));
  }

  getDocument(): SettingsDocumentV2 {
    return cloneSettingsDocument(this.#document);
  }

  getLoadState(): SettingsLoadState {
    return { ...this.#loadState };
  }

  patch(patch: Partial<LocalSettings>): Promise<LocalSettings> {
    const operation = this.#pending.then(async () => {
      const next = applyPatch(this.getSettings(), patch);
      const document = settingsDocumentFromLocalSettings(next);
      if (this.#writable) {
        await this.#store.write(document);
        if (this.#loadState.kind === "missing")
          this.#loadState = { kind: "loaded", schemaVersion: 2 };
      }
      this.#document = document;
      for (const listener of this.#listeners) listener(cloneLocalSettings(next));
      return cloneLocalSettings(next);
    });
    this.#pending = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  subscribe(listener: SettingsListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
