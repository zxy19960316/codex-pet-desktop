import type { PetStateChange } from "../pet/pet-state";
import { isObject } from "./protocol-guards";

export const CODEX_HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PreCompact",
  "PostCompact",
  "SubagentStart",
  "SubagentStop",
  "Stop",
] as const;

export interface CodexHookEvent {
  sessionId: string;
  turnId?: string;
  name: (typeof CODEX_HOOK_EVENTS)[number];
  timestamp: number;
}

export function parseCodexHookEvent(value: unknown): CodexHookEvent | undefined {
  if (!isObject(value)) return undefined;
  const name = value.hook_event_name;
  const sessionId = value.session_id;
  if (
    typeof name !== "string" ||
    !CODEX_HOOK_EVENTS.includes(name as CodexHookEvent["name"]) ||
    typeof sessionId !== "string" ||
    !sessionId
  )
    return undefined;
  return {
    sessionId,
    turnId: typeof value.turn_id === "string" ? value.turn_id : undefined,
    name: name as CodexHookEvent["name"],
    timestamp: Date.now(),
  };
}

export function hookEventToPetState(event: CodexHookEvent): PetStateChange {
  const state =
    event.name === "SessionStart"
      ? "idle"
      : event.name === "UserPromptSubmit" ||
          event.name === "PreCompact" ||
          event.name === "PostCompact" ||
          event.name === "SubagentStop"
        ? "thinking"
        : event.name === "PermissionRequest"
          ? "approval"
          : event.name === "Stop"
            ? "success"
            : "working";
  return {
    threadId: event.sessionId,
    turnId: event.turnId,
    state,
    source: `codex-hook:${event.name}`,
    timestamp: event.timestamp,
    transientReturnState: event.name === "Stop" ? "idle" : undefined,
  };
}
