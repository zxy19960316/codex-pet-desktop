import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type DesktopApi, type DesktopSnapshot } from "../shared/ipc-contract";

const api: DesktopApi = {
  getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.getSnapshot),
  subscribe: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: DesktopSnapshot) =>
      listener(snapshot);
    ipcRenderer.on(IPC_CHANNELS.snapshot, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.snapshot, handler);
  },
  setPetState: (state) => ipcRenderer.invoke(IPC_CHANNELS.setPetState, state),
  respondApproval: (requestId, decision) =>
    ipcRenderer.invoke(IPC_CHANNELS.respondApproval, requestId, decision),
  toggleHud: () => ipcRenderer.invoke(IPC_CHANNELS.toggleHud),
  toggleDebug: () => ipcRenderer.invoke(IPC_CHANNELS.toggleDebug),
  toggleAlwaysOnTop: () => ipcRenderer.invoke(IPC_CHANNELS.toggleAlwaysOnTop),
  toggleClickThrough: () => ipcRenderer.invoke(IPC_CHANNELS.toggleClickThrough),
  reconnectCodex: () => ipcRenderer.invoke(IPC_CHANNELS.reconnectCodex),
  patchSettings: (patch) => ipcRenderer.invoke(IPC_CHANNELS.patchSettings, patch),
  adjustPetScale: (deltaSteps) => ipcRenderer.invoke(IPC_CHANNELS.adjustPetScale, deltaSteps),
  enqueueMockApproval: () => ipcRenderer.invoke(IPC_CHANNELS.enqueueMockApproval),
  respondUserInput: (requestId, answers) =>
    ipcRenderer.invoke(IPC_CHANNELS.respondUserInput, requestId, answers),
  cancelUserInput: (requestId) => ipcRenderer.invoke(IPC_CHANNELS.cancelUserInput, requestId),
  enqueueMockUserInput: () => ipcRenderer.invoke(IPC_CHANNELS.enqueueMockUserInput),
  createThread: (request) => ipcRenderer.invoke(IPC_CHANNELS.createThread, request),
  startTurn: (request) => ipcRenderer.invoke(IPC_CHANNELS.startTurn, request),
  steerTurn: (request) => ipcRenderer.invoke(IPC_CHANNELS.steerTurn, request),
  interruptTurn: (request) => ipcRenderer.invoke(IPC_CHANNELS.interruptTurn, request),
  selectThread: (threadId) => ipcRenderer.invoke(IPC_CHANNELS.selectThread, threadId),
  runApprovalTest: () => ipcRenderer.invoke(IPC_CHANNELS.runApprovalTest),
  runUserInputTest: () => ipcRenderer.invoke(IPC_CHANNELS.runUserInputTest),
  startVerification: () => ipcRenderer.invoke(IPC_CHANNELS.startVerification),
  runVerification: (kind) => ipcRenderer.invoke(IPC_CHANNELS.runVerification, kind),
  quit: () => ipcRenderer.invoke(IPC_CHANNELS.quit),
  updateWindowShape: (request) => ipcRenderer.send(IPC_CHANNELS.updateWindowShape, request),
};

contextBridge.exposeInMainWorld("codexPet", Object.freeze(api));
