import { contextBridge, ipcRenderer } from "electron";
import {
  SETTINGS_IPC_CHANNELS,
  type SettingsApi,
  type SettingsWindowSnapshot,
} from "../shared/ipc/settings-ipc";

const api: SettingsApi = {
  getSnapshot: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.getSnapshot),
  subscribe: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: SettingsWindowSnapshot) =>
      listener(snapshot);
    ipcRenderer.on(SETTINGS_IPC_CHANNELS.snapshot, handler);
    return () => ipcRenderer.removeListener(SETTINGS_IPC_CHANNELS.snapshot, handler);
  },
  patch: (patch) => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.patch, patch),
  setActivePet: (id) => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.setActivePet, id),
  importPetPackage: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.importPetPackage),
  importCodexPokePet: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.importCodexPokePet),
  scanCodexPokePets: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.scanCodexPokePets),
  importDiscoveredCodexPokePet: (sourcePetId) =>
    ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.importDiscoveredCodexPokePet, sourcePetId),
  rescanPets: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.rescanPets),
  openPetsDirectory: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.openPetsDirectory),
};

contextBridge.exposeInMainWorld("codexPetSettings", Object.freeze(api));
