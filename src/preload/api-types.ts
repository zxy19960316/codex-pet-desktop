export type { DesktopApi, DesktopSnapshot } from "../shared/ipc-contract";

declare global {
  interface Window {
    codexPet: import("../shared/ipc-contract").DesktopApi;
  }
}
