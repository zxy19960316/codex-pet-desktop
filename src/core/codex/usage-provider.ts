export interface RateLimitBucket {
  id: string;
  label?: string;
  usedPercent: number;
  remainingPercent: number;
  windowDurationMins: number;
  resetsAt: number;
  source: "codex-app-server" | "codex-session" | "mock";
}

export interface DailyUsage {
  tokens: number;
  measuredAt: number;
  source: "codex-app-server" | "mock";
}

export interface ThreadTokenUsage {
  threadId: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens: number;
  updatedAt: number;
}

export interface UsageProvider {
  readRateLimits(): Promise<RateLimitBucket[]>;
  readDailyUsage(): Promise<DailyUsage | null>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface RawBucket {
  id: string;
  label?: string;
  usedPercent: number;
  windowDurationMins: number;
  resetsAt: number;
  source?: RateLimitBucket["source"];
}

export function normalizeRateLimitBucket(bucket: RawBucket): RateLimitBucket {
  const usedPercent = Math.min(
    100,
    Math.max(0, Number.isFinite(bucket.usedPercent) ? bucket.usedPercent : 0),
  );
  return {
    ...bucket,
    usedPercent,
    remainingPercent: Math.min(100, Math.max(0, 100 - usedPercent)),
    windowDurationMins: Math.max(0, bucket.windowDurationMins),
    resetsAt:
      bucket.resetsAt > 0 && bucket.resetsAt < 10_000_000_000
        ? bucket.resetsAt * 1_000
        : bucket.resetsAt,
    source: bucket.source ?? "codex-app-server",
  };
}

export function sortRateLimitBuckets(buckets: RateLimitBucket[]): RateLimitBucket[] {
  return [...buckets].sort((a, b) => a.windowDurationMins - b.windowDurationMins);
}

export function formatResetCountdown(resetsAt: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((resetsAt - now) / 1_000));
  if (!seconds) return "ready";
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return [hours ? `${hours}h` : "", minutes || hours ? `${minutes}m` : "", `${remainder}s`]
    .filter(Boolean)
    .join(" ");
}

export class MockUsageProvider implements UsageProvider {
  async readRateLimits(): Promise<RateLimitBucket[]> {
    const now = Date.now();
    return sortRateLimitBuckets([
      normalizeRateLimitBucket({
        id: "mock-short",
        label: "Short window",
        usedPercent: 38,
        windowDurationMins: 300,
        resetsAt: now + 2_700_000,
        source: "mock",
      }),
      normalizeRateLimitBucket({
        id: "mock-long",
        label: "Long window",
        usedPercent: 62,
        windowDurationMins: 10_080,
        resetsAt: now + 259_200_000,
        source: "mock",
      }),
    ]);
  }
  async readDailyUsage(): Promise<DailyUsage> {
    return { tokens: 12_345, measuredAt: Date.now(), source: "mock" };
  }
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}

interface RequestClient {
  sendRequest<T = unknown>(method: string, params?: unknown): Promise<T>;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown): number | null {
  const converted =
    typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isFinite(converted) ? converted : null;
}

export function normalizeThreadTokenUsage(
  threadId: string,
  raw: unknown,
  updatedAt = Date.now(),
): ThreadTokenUsage | null {
  const usage = object(raw);
  const total = object(usage.total);
  const value = (key: string): number | undefined => {
    const parsed = numberValue(total[key]);
    return parsed !== null && parsed >= 0 ? parsed : undefined;
  };
  const totalTokens = value("totalTokens");
  if (!threadId || totalTokens === undefined) return null;
  return {
    threadId,
    inputTokens: value("inputTokens"),
    cachedInputTokens: value("cachedInputTokens"),
    outputTokens: value("outputTokens"),
    reasoningOutputTokens: value("reasoningOutputTokens"),
    totalTokens,
    updatedAt,
  };
}

function snapshotBuckets(snapshotValue: unknown, prefix: string): RateLimitBucket[] {
  const snapshot = object(snapshotValue);
  const label = typeof snapshot.limitName === "string" ? snapshot.limitName : undefined;
  return (["primary", "secondary"] as const).flatMap((name) => {
    const window = object(snapshot[name]);
    const usedPercent = numberValue(window.usedPercent);
    const windowDurationMins = numberValue(window.windowDurationMins);
    const resetsAt = numberValue(window.resetsAt);
    if (usedPercent === null || windowDurationMins === null || resetsAt === null) return [];
    return [
      normalizeRateLimitBucket({
        id: `${prefix}-${name}`,
        label: label ? `${label} ${name}` : name,
        usedPercent,
        windowDurationMins,
        resetsAt,
      }),
    ];
  });
}

export class CodexUsageProvider implements UsageProvider {
  readonly #client: RequestClient;

  constructor(client: RequestClient) {
    this.#client = client;
  }

  async readRateLimits(): Promise<RateLimitBucket[]> {
    const response = object(await this.#client.sendRequest("account/rateLimits/read"));
    const byId = object(response.rateLimitsByLimitId);
    const buckets = Object.keys(byId).length
      ? Object.entries(byId).flatMap(([id, snapshot]) => snapshotBuckets(snapshot, id))
      : snapshotBuckets(response.rateLimits, "default");
    return sortRateLimitBuckets(buckets);
  }

  async readDailyUsage(): Promise<DailyUsage | null> {
    const response = object(await this.#client.sendRequest("account/usage/read"));
    const buckets = Array.isArray(response.dailyUsageBuckets)
      ? response.dailyUsageBuckets.map(object)
      : [];
    const today = new Date().toISOString().slice(0, 10);
    const bucket = buckets.find((candidate) => candidate.startDate === today) ?? buckets.at(-1);
    const tokens = numberValue(bucket?.tokens);
    return tokens === null ? null : { tokens, measuredAt: Date.now(), source: "codex-app-server" };
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}
