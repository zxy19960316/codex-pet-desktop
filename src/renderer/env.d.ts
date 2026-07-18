/// <reference types="vite/client" />

import type { DesktopApi } from "../shared/ipc-contract";
import type { SettingsApi } from "../shared/ipc/settings-ipc";

declare global {
  interface Window {
    codexPet: DesktopApi;
    codexPetSettings: SettingsApi;
  }
}

export {};
