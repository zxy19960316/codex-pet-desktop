import { normalizeRateLimitBucket, type RateLimitBucket } from "./usage-provider";

export interface AgentTelemetry {
  model: string | null;
  reasoningEffort: string | null;
  currentTokens: number | null;
  contextWindowTokens: number | null;
  rateLimits: RateLimitBucket[] | null;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeLabel(value: unknown, maximum: number): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    /^[A-Za-z0-9._-]+$/.test(value)
    ? value
    : null;
}

function safeCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function sessionRateLimit(value: unknown, id: "primary" | "secondary"): RateLimitBucket | null {
  const window = record(value);
  if (!window) return null;
  const usedPercent = safeCount(window.used_percent);
  const windowDurationMins = safeCount(window.window_minutes);
  const resetsAt = safeCount(window.resets_at);
  if (usedPercent === null || windowDurationMins === null || resetsAt === null) return null;
  return normalizeRateLimitBucket({
    id: `session-${id}`,
    label:
      windowDurationMins === 300 ? "5H" : windowDurationMins >= 5 * 24 * 60 ? "Weekly" : undefined,
    usedPercent,
    windowDurationMins,
    resetsAt,
    source: "codex-session",
  });
}

export function parseSessionTelemetry(
  content: string,
  initial?: AgentTelemetry | null,
): AgentTelemetry | null {
  let telemetry: AgentTelemetry | null = initial ? { ...initial } : null;
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const root = record(parsed);
    const payload = record(root?.payload);
    if (!root || !payload) continue;
    if (root.type === "turn_context") {
      const model = safeLabel(payload.model, 64);
      const collaboration = record(payload.collaboration_mode);
      const collaborationSettings = record(collaboration?.settings);
      const reasoningEffort =
        safeLabel(payload.effort, 24) ?? safeLabel(collaborationSettings?.reasoning_effort, 24);
      if (model || reasoningEffort) {
        telemetry ??= {
          model: null,
          reasoningEffort: null,
          currentTokens: null,
          contextWindowTokens: null,
          rateLimits: null,
        };
        if (model) telemetry.model = model;
        if (reasoningEffort) telemetry.reasoningEffort = reasoningEffort;
      }
      continue;
    }
    if (root.type !== "event_msg" || payload.type !== "token_count") continue;
    const info = record(payload.info);
    const lastUsage = record(info?.last_token_usage);
    const currentTokens = safeCount(lastUsage?.total_tokens);
    const contextWindowTokens = safeCount(info?.model_context_window);
    const rateLimits = record(payload.rate_limits);
    const buckets = [
      sessionRateLimit(rateLimits?.primary, "primary"),
      sessionRateLimit(rateLimits?.secondary, "secondary"),
    ].filter((bucket): bucket is RateLimitBucket => Boolean(bucket));
    if (currentTokens !== null || contextWindowTokens !== null || buckets.length) {
      telemetry ??= {
        model: null,
        reasoningEffort: null,
        currentTokens: null,
        contextWindowTokens: null,
        rateLimits: null,
      };
      if (currentTokens !== null) telemetry.currentTokens = currentTokens;
      if (contextWindowTokens !== null) telemetry.contextWindowTokens = contextWindowTokens;
      if (buckets.length) telemetry.rateLimits = buckets;
    }
  }
  return telemetry;
}
