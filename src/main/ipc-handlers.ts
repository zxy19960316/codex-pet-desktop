import { app, ipcMain } from "electron";
import type { ApprovalDecision } from "../core/codex/approval-router";
import { isPetState } from "../core/pet/pet-state";
import { IPC_CHANNELS, type DesktopSnapshot } from "../shared/ipc-contract";
import type { LocalSettings } from "../shared/settings";

export interface IpcActions {
  getSnapshot(): DesktopSnapshot;
  setPetState(state: DesktopSnapshot["petState"]): void;
  respondApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
  toggleHud(): Promise<void>;
  toggleDebug(): Promise<void>;
  toggleAlwaysOnTop(): Promise<void>;
  toggleClickThrough(): Promise<void>;
  reconnectCodex(): Promise<void>;
  patchSettings(patch: Partial<LocalSettings>): Promise<void>;
  enqueueMockApproval(): void;
}

const DECISIONS = new Set<ApprovalDecision>(["accept", "acceptForSession", "decline", "cancel"]);

export function registerIpcHandlers(actions: IpcActions): () => void {
  ipcMain.handle(IPC_CHANNELS.getSnapshot, () => actions.getSnapshot());
  ipcMain.handle(IPC_CHANNELS.setPetState, (_event, state: unknown) => {
    if (!isPetState(state)) throw new Error("Invalid pet state");
    actions.setPetState(state);
  });
  ipcMain.handle(IPC_CHANNELS.respondApproval, (_event, requestId: unknown, decision: unknown) => {
    if (typeof requestId !== "string" || !DECISIONS.has(decision as ApprovalDecision))
      throw new Error("Invalid approval response");
    return actions.respondApproval(requestId, decision as ApprovalDecision);
  });
  ipcMain.handle(IPC_CHANNELS.toggleHud, () => actions.toggleHud());
  ipcMain.handle(IPC_CHANNELS.toggleDebug, () => actions.toggleDebug());
  ipcMain.handle(IPC_CHANNELS.toggleAlwaysOnTop, () => actions.toggleAlwaysOnTop());
  ipcMain.handle(IPC_CHANNELS.toggleClickThrough, () => actions.toggleClickThrough());
  ipcMain.handle(IPC_CHANNELS.reconnectCodex, () => actions.reconnectCodex());
  ipcMain.handle(IPC_CHANNELS.patchSettings, (_event, patch: Partial<LocalSettings>) =>
    actions.patchSettings(patch),
  );
  ipcMain.handle(IPC_CHANNELS.enqueueMockApproval, () => actions.enqueueMockApproval());
  ipcMain.handle(IPC_CHANNELS.quit, () => app.quit());
  return () => {
    for (const channel of Object.values(IPC_CHANNELS)) ipcMain.removeHandler(channel);
  };
}
