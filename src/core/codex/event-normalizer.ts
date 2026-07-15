import type { PetState } from "../pet/pet-state";
import { isObject, stringField } from "./protocol-guards";

export type DomainEvent =
  | {
      type: "pet-state";
      state: PetState;
      threadId: string;
      turnId?: string;
      source: string;
      timestamp: number;
    }
  | { type: "token-usage"; threadId: string; turnId?: string; tokenUsage: unknown }
  | { type: "rate-limits"; rateLimits: unknown }
  | { type: "approval-resolved"; requestId: string; threadId?: string }
  | { type: "thread-ended"; threadId: string }
  | { type: "turn-completed"; threadId: string; turnId?: string }
  | { type: "diagnostic"; code: "unknown-notification"; method: string };

function petEvent(state: PetState, method: string, params: unknown): DomainEvent {
  return {
    type: "pet-state",
    state,
    threadId: stringField(params, ["threadId"]) ?? "unknown",
    turnId: stringField(params, ["turnId"], ["turn", "id"]),
    source: `codex:${method}`,
    timestamp: Date.now(),
  };
}

export class EventNormalizer {
  normalizeNotification(method: string, params: unknown): DomainEvent[] {
    if (method === "turn/started") return [petEvent("thinking", method, params)];
    if (method === "item/commandExecution/started") return [petEvent("working", method, params)];
    if (method === "item/fileChange/started") return [petEvent("typing", method, params)];
    if (method === "item/started") {
      const item = isObject(params) && isObject(params.item) ? params.item : {};
      if (item.type === "fileChange") return [petEvent("typing", method, params)];
      if (
        ["commandExecution", "mcpToolCall", "dynamicToolCall", "collabAgentToolCall"].includes(
          String(item.type),
        )
      )
        return [petEvent("working", method, params)];
      return [petEvent("thinking", method, params)];
    }
    if (method === "turn/completed") {
      const turn = isObject(params) && isObject(params.turn) ? params.turn : {};
      const status = turn.status;
      return [
        petEvent(
          status === "failed"
            ? "error"
            : status === "interrupted" || status === "cancelled"
              ? "idle"
              : "success",
          method,
          params,
        ),
        {
          type: "turn-completed",
          threadId: stringField(params, ["threadId"]) ?? "unknown",
          turnId: stringField(params, ["turnId"], ["turn", "id"]),
        },
      ];
    }
    if (method === "error") return [petEvent("error", method, params)];
    if (method === "thread/closed" || method === "thread/deleted") {
      const threadId = stringField(params, ["threadId"]) ?? "unknown";
      return [petEvent("idle", method, params), { type: "thread-ended", threadId }];
    }
    if (method === "thread/tokenUsage/updated") {
      return [
        {
          type: "token-usage",
          threadId: stringField(params, ["threadId"]) ?? "unknown",
          turnId: stringField(params, ["turnId"]),
          tokenUsage: isObject(params) ? params.tokenUsage : undefined,
        },
      ];
    }
    if (method === "account/rateLimits/updated")
      return [
        { type: "rate-limits", rateLimits: isObject(params) ? params.rateLimits : undefined },
      ];
    if (method === "serverRequest/resolved")
      return [
        {
          type: "approval-resolved",
          requestId: String(isObject(params) ? (params.requestId ?? "") : ""),
          threadId: stringField(params, ["threadId"]),
        },
      ];
    return [{ type: "diagnostic", code: "unknown-notification", method }];
  }
}
