import type { LocalSettings } from "../../shared/settings";
import {
  SETTINGS_IPC_CHANNELS,
  type SettingsPatch,
  type SettingsWindowSnapshot,
} from "../../shared/ipc/settings-ipc";

interface SettingsIpcEvent {
  sender: { id: number };
}

export interface SettingsIpcRegistrar {
  handle(channel: string, listener: (event: SettingsIpcEvent, ...args: unknown[]) => unknown): void;
  removeHandler(channel: string): void;
}

export interface SettingsIpcActions {
  getSnapshot(): SettingsWindowSnapshot;
  patchSettings(patch: Partial<LocalSettings>): Promise<void>;
  getSettingsSenderId(): number | undefined;
  setActivePet(id: string): Promise<void>;
  importPetPackage(): Promise<void>;
  importCodexPokePet(): Promise<void>;
  scanCodexPokePets(): Promise<void>;
  importDiscoveredCodexPokePet(sourcePetId: string): Promise<void>;
  rescanPets(): Promise<void>;
  openPetsDirectory(): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unknownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): string[] {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

function booleanField(value: unknown, key: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Invalid ${key}`);
  return value;
}

export function parsePetId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
    throw new Error("Invalid pet id");
  return value;
}

export function assertSettingsSender(senderId: number, expectedSenderId: number | undefined): void {
  if (expectedSenderId === undefined || senderId !== expectedSenderId)
    throw new Error("Unauthorized Settings IPC sender");
}

export function parseSettingsPatch(value: unknown): SettingsPatch {
  if (!isRecord(value)) throw new Error("Invalid settings patch");
  const partitions = new Set(["preferences", "device"]);
  if (unknownKeys(value, partitions).length) throw new Error("Unknown settings partition");
  const patch: SettingsPatch = {};

  if (Object.hasOwn(value, "preferences")) {
    if (!isRecord(value.preferences)) throw new Error("Invalid settings preferences");
    const allowed = new Set([
      "alwaysOnTop",
      "clickThrough",
      "soundEnabled",
      "quotaWarningPercent",
      "petDisplay",
    ]);
    if (unknownKeys(value.preferences, allowed).length) throw new Error("Unknown settings field");
    const preferences: NonNullable<SettingsPatch["preferences"]> = {};
    if (Object.hasOwn(value.preferences, "alwaysOnTop"))
      preferences.alwaysOnTop = booleanField(value.preferences.alwaysOnTop, "alwaysOnTop");
    if (Object.hasOwn(value.preferences, "clickThrough"))
      preferences.clickThrough = booleanField(value.preferences.clickThrough, "clickThrough");
    if (Object.hasOwn(value.preferences, "soundEnabled"))
      preferences.soundEnabled = booleanField(value.preferences.soundEnabled, "soundEnabled");
    if (Object.hasOwn(value.preferences, "quotaWarningPercent")) {
      const quota = value.preferences.quotaWarningPercent;
      if (typeof quota !== "number" || !Number.isFinite(quota) || quota < 0 || quota > 100)
        throw new Error("Invalid quotaWarningPercent");
      preferences.quotaWarningPercent = quota;
    }
    if (Object.hasOwn(value.preferences, "petDisplay")) {
      if (!isRecord(value.preferences.petDisplay)) throw new Error("Invalid petDisplay");
      const displayAllowed = new Set(["scalePercent", "lockPhysicalSizeAcrossDisplays"]);
      if (unknownKeys(value.preferences.petDisplay, displayAllowed).length)
        throw new Error("Unknown petDisplay field");
      const petDisplay: NonNullable<NonNullable<SettingsPatch["preferences"]>["petDisplay"]> = {};
      if (Object.hasOwn(value.preferences.petDisplay, "scalePercent")) {
        const scale = value.preferences.petDisplay.scalePercent;
        if (typeof scale !== "number" || !Number.isFinite(scale))
          throw new Error("Invalid scalePercent");
        petDisplay.scalePercent = scale;
      }
      if (Object.hasOwn(value.preferences.petDisplay, "lockPhysicalSizeAcrossDisplays"))
        petDisplay.lockPhysicalSizeAcrossDisplays = booleanField(
          value.preferences.petDisplay.lockPhysicalSizeAcrossDisplays,
          "lockPhysicalSizeAcrossDisplays",
        );
      preferences.petDisplay = petDisplay;
    }
    patch.preferences = preferences;
  }

  if (Object.hasOwn(value, "device")) {
    if (!isRecord(value.device)) throw new Error("Invalid device settings");
    const allowed = new Set(["useMockData", "autoStartAppServer"]);
    if (unknownKeys(value.device, allowed).length) throw new Error("Unknown settings field");
    const device: NonNullable<SettingsPatch["device"]> = {};
    if (Object.hasOwn(value.device, "useMockData"))
      device.useMockData = booleanField(value.device.useMockData, "useMockData");
    if (Object.hasOwn(value.device, "autoStartAppServer"))
      device.autoStartAppServer = booleanField(
        value.device.autoStartAppServer,
        "autoStartAppServer",
      );
    patch.device = device;
  }

  return patch;
}

export function settingsPatchToLocalSettings(patch: SettingsPatch): Partial<LocalSettings> {
  const { petDisplay, ...preferences } = patch.preferences ?? {};
  return { ...preferences, ...petDisplay, ...patch.device };
}

export function registerSettingsIpcHandlers(
  registrar: SettingsIpcRegistrar,
  actions: SettingsIpcActions,
): () => void {
  registrar.handle(SETTINGS_IPC_CHANNELS.getSnapshot, (event) => {
    assertSettingsSender(event.sender.id, actions.getSettingsSenderId());
    return actions.getSnapshot();
  });
  registrar.handle(SETTINGS_IPC_CHANNELS.patch, (event, value) => {
    assertSettingsSender(event.sender.id, actions.getSettingsSenderId());
    return actions.patchSettings(settingsPatchToLocalSettings(parseSettingsPatch(value)));
  });
  registrar.handle(SETTINGS_IPC_CHANNELS.setActivePet, (event, value) => {
    assertSettingsSender(event.sender.id, actions.getSettingsSenderId());
    return actions.setActivePet(parsePetId(value));
  });
  registrar.handle(SETTINGS_IPC_CHANNELS.importPetPackage, (event) => {
    assertSettingsSender(event.sender.id, actions.getSettingsSenderId());
    return actions.importPetPackage();
  });
  registrar.handle(SETTINGS_IPC_CHANNELS.importCodexPokePet, (event) => {
    assertSettingsSender(event.sender.id, actions.getSettingsSenderId());
    return actions.importCodexPokePet();
  });
  registrar.handle(SETTINGS_IPC_CHANNELS.scanCodexPokePets, (event) => {
    assertSettingsSender(event.sender.id, actions.getSettingsSenderId());
    return actions.scanCodexPokePets();
  });
  registrar.handle(SETTINGS_IPC_CHANNELS.importDiscoveredCodexPokePet, (event, value) => {
    assertSettingsSender(event.sender.id, actions.getSettingsSenderId());
    return actions.importDiscoveredCodexPokePet(parsePetId(value));
  });
  registrar.handle(SETTINGS_IPC_CHANNELS.rescanPets, (event) => {
    assertSettingsSender(event.sender.id, actions.getSettingsSenderId());
    return actions.rescanPets();
  });
  registrar.handle(SETTINGS_IPC_CHANNELS.openPetsDirectory, (event) => {
    assertSettingsSender(event.sender.id, actions.getSettingsSenderId());
    return actions.openPetsDirectory();
  });
  return () => {
    registrar.removeHandler(SETTINGS_IPC_CHANNELS.getSnapshot);
    registrar.removeHandler(SETTINGS_IPC_CHANNELS.patch);
    registrar.removeHandler(SETTINGS_IPC_CHANNELS.setActivePet);
    registrar.removeHandler(SETTINGS_IPC_CHANNELS.importPetPackage);
    registrar.removeHandler(SETTINGS_IPC_CHANNELS.importCodexPokePet);
    registrar.removeHandler(SETTINGS_IPC_CHANNELS.scanCodexPokePets);
    registrar.removeHandler(SETTINGS_IPC_CHANNELS.importDiscoveredCodexPokePet);
    registrar.removeHandler(SETTINGS_IPC_CHANNELS.rescanPets);
    registrar.removeHandler(SETTINGS_IPC_CHANNELS.openPetsDirectory);
  };
}
