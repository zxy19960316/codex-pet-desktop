import type { PetState } from "../../core/pet/pet-state";
import type { DesktopSnapshot } from "../../shared/ipc-contract";
import type { SettingsSection } from "../../shared/ipc/settings-ipc";

export const PET_SIZE_SHORTCUTS = [50, 75, 100, 125, 150, 175, 200] as const;

export type PetMenuAction =
  | { type: "show-or-hide" }
  | { type: "open-status" }
  | { type: "open-settings"; section?: SettingsSection }
  | { type: "select-pet"; id: string }
  | { type: "set-scale"; scalePercent: number }
  | { type: "toggle-hud" }
  | { type: "toggle-always-on-top" }
  | { type: "toggle-click-through" }
  | { type: "new-thread" }
  | { type: "interrupt-turn"; threadId: string; turnId: string }
  | { type: "open-approval" }
  | { type: "open-reply" }
  | { type: "connect-codex-hook" }
  | { type: "reconnect-codex" }
  | { type: "about" }
  | { type: "quit" };

export interface PetMenuItem {
  label?: string;
  type?: "separator" | "checkbox" | "radio";
  enabled?: boolean;
  checked?: boolean;
  action?: PetMenuAction;
  submenu?: PetMenuItem[];
}

export interface PetMenuViewModel {
  statusLabel: string;
  pets: Array<{ id: string; name: string; active: boolean }>;
  scalePercent: number;
  hudVisible: boolean;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  hasApproval: boolean;
  hasUserInput: boolean;
  activeTurn?: { threadId: string; turnId: string };
}

const STATE_LABELS: Record<PetState, string> = {
  sleep: "Sleep",
  idle: "Idle",
  thinking: "Thinking",
  typing: "Typing",
  working: "Working",
  approval: "Approval",
  waiting_input: "Waiting for input",
  success: "Success",
  error: "Error",
  quota_low: "Quota low",
  quota_empty: "Quota empty",
  offline: "Offline",
};

export function buildPetMenuViewModel(snapshot: DesktopSnapshot): PetMenuViewModel {
  const activeThread = snapshot.selectedThread?.activeTurnId
    ? { threadId: snapshot.selectedThread.threadId, turnId: snapshot.selectedThread.activeTurnId }
    : snapshot.threads
        .filter((thread) => thread.activeTurnId)
        .map((thread) => ({ threadId: thread.threadId, turnId: thread.activeTurnId! }))[0];
  return {
    statusLabel: `Current: ${STATE_LABELS[snapshot.petState]} · ${snapshot.activeThreadCount} ${snapshot.activeThreadCount === 1 ? "thread" : "threads"}`,
    pets: (snapshot.pet?.available ?? []).map(({ id, name, active }) => ({ id, name, active })),
    scalePercent: snapshot.settings.scalePercent,
    hudVisible: snapshot.settings.hudVisible,
    alwaysOnTop: snapshot.settings.alwaysOnTop,
    clickThrough: snapshot.settings.clickThrough,
    hasApproval: snapshot.approvals.length > 0,
    hasUserInput: snapshot.userInputs.length > 0,
    activeTurn: activeThread,
  };
}

export function buildPetMenuTemplate(
  viewModel: PetMenuViewModel,
  host: "pet" | "tray",
): PetMenuItem[] {
  const requestItems: PetMenuItem[] = [];
  if (viewModel.hasApproval)
    requestItems.push({ label: "Open approval", action: { type: "open-approval" } });
  if (viewModel.hasUserInput)
    requestItems.push({ label: "Reply to Codex", action: { type: "open-reply" } });
  const petItems: PetMenuItem[] = viewModel.pets.map((pet) => ({
    label: pet.name,
    type: "radio",
    checked: pet.active,
    action: { type: "select-pet", id: pet.id },
  }));
  petItems.push({ type: "separator" });
  petItems.push({ label: "Manage pets...", action: { type: "open-settings", section: "pets" } });
  const scaleItems: PetMenuItem[] = PET_SIZE_SHORTCUTS.map((scalePercent) => ({
    label: `${scalePercent}%`,
    type: "radio",
    checked: viewModel.scalePercent === scalePercent,
    action: { type: "set-scale", scalePercent },
  }));
  if (host === "tray") {
    scaleItems.push({ type: "separator" });
    scaleItems.push({
      label: "Restore default size",
      action: { type: "set-scale", scalePercent: 100 },
    });
  }
  scaleItems.push({ label: "Custom...", action: { type: "open-settings", section: "general" } });

  const template: PetMenuItem[] = [
    { label: viewModel.statusLabel, enabled: false },
    { type: "separator" },
    ...(host === "tray"
      ? [{ label: "Show / hide pet", action: { type: "show-or-hide" } as const }]
      : []),
    { label: "Open status panel", action: { type: "open-status" } },
    ...requestItems,
    { label: "Open Settings Center", action: { type: "open-settings" } },
    { type: "separator" },
    { label: "Pet", submenu: petItems },
    { label: "Size", submenu: scaleItems },
    { type: "separator" },
    {
      label: "Show HUD",
      type: "checkbox",
      checked: viewModel.hudVisible,
      action: { type: "toggle-hud" },
    },
    {
      label: "Always on top",
      type: "checkbox",
      checked: viewModel.alwaysOnTop,
      action: { type: "toggle-always-on-top" },
    },
    {
      label: "Click-through",
      type: "checkbox",
      checked: viewModel.clickThrough,
      action: { type: "toggle-click-through" },
    },
    { type: "separator" },
    { label: "New Codex thread", action: { type: "new-thread" } },
  ];
  if (viewModel.activeTurn)
    template.push({
      label: "Interrupt current turn",
      action: { type: "interrupt-turn", ...viewModel.activeTurn },
    });
  if (host === "tray") {
    template.push({ type: "separator" });
    template.push({ label: "Connect Codex activity", action: { type: "connect-codex-hook" } });
    template.push({ label: "Reconnect App Server", action: { type: "reconnect-codex" } });
    template.push({ label: "About", action: { type: "about" } });
  }
  template.push({ type: "separator" });
  template.push({ label: "Exit", action: { type: "quit" } });
  return template;
}
