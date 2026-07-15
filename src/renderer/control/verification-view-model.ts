import type { E2EVerificationKind } from "../../core/codex/control-types";
import type { DesktopSnapshot } from "../../shared/ipc-contract";

export interface VerificationAvailability {
  canStart: boolean;
  reason?: string;
}

export interface VerificationStepMetadata {
  kind: E2EVerificationKind;
  label: string;
  instruction: string;
}

export const VERIFICATION_STEPS: VerificationStepMetadata[] = [
  {
    kind: "approval-allow",
    label: "Approval Allow",
    instruction: "Run the step, then click Allow on the M2.6 approval card.",
  },
  {
    kind: "approval-deny",
    label: "Approval Deny",
    instruction: "Run the step, then click Deny on the M2.6 approval card.",
  },
  {
    kind: "user-input",
    label: "User Input",
    instruction: "Run the step, choose A or B, and send the reply.",
  },
  {
    kind: "steer",
    label: "Steer",
    instruction: "Run the step, then send the fixed STEERED instruction.",
  },
  {
    kind: "interrupt",
    label: "Interrupt",
    instruction: "Run the step, then interrupt its active turn.",
  },
];

export function verificationAvailability(
  snapshot: Pick<DesktopSnapshot, "connectionStatus" | "protocolSource" | "settings">,
): VerificationAvailability {
  if (snapshot.settings.useMockData || snapshot.protocolSource === "mock")
    return {
      canStart: false,
      reason: "Real verification is unavailable while Mock data is enabled",
    };
  if (snapshot.connectionStatus !== "connected" || snapshot.protocolSource !== "codex-app-server")
    return {
      canStart: false,
      reason: "Connect Codex App Server before running verification",
    };
  return { canStart: true };
}
