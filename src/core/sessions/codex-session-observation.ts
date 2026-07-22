import type { CodexHookEvent } from "../codex/hook-event";
import type { PetStateChange } from "../pet/pet-state";
import type { AgentSessionState, SessionObservation } from "./session-types";

function stateFromPet(state: PetStateChange["state"]): AgentSessionState {
  if (state === "typing" || state === "working") return "working";
  if (state === "waiting_input") return "waiting_input";
  if (state === "approval") return "approval";
  if (state === "thinking") return "thinking";
  if (state === "success") return "success";
  if (state === "error") return "error";
  if (state === "offline") return "offline";
  return "idle";
}

export function observationFromPetState(change: PetStateChange): SessionObservation {
  return {
    providerId: "codex",
    sessionId: change.threadId,
    source: change.source.startsWith("codex-hook") ? "codex-hooks" : "codex-app-server",
    timestamp: change.timestamp,
    state: stateFromPet(change.state),
    turnId: change.turnId,
    event:
      change.state === "approval"
        ? "approval_required"
        : change.state === "waiting_input"
          ? "input_required"
          : change.state === "success"
            ? "turn_completed"
            : change.state === "error"
              ? "turn_failed"
              : undefined,
  };
}

export function observationFromHook(event: CodexHookEvent): SessionObservation {
  return {
    providerId: "codex",
    sessionId: event.sessionId,
    source: "codex-hooks",
    timestamp: event.timestamp,
    turnId: event.turnId,
    event:
      event.name === "SessionStart"
        ? "session_started"
        : event.name === "Stop"
          ? "turn_completed"
          : undefined,
  };
}
