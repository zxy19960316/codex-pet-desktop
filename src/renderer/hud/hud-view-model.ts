import type { RateLimitBucket } from "../../core/codex/usage-provider";

export function formatTokenCount(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "Data unavailable"
    : new Intl.NumberFormat().format(value);
}

export function rateLimitLabel(bucket: RateLimitBucket): string {
  return bucket.label ?? `${bucket.windowDurationMins} min window`;
}

export function selectCompactBuckets(
  buckets: RateLimitBucket[] | null,
): [RateLimitBucket | null, RateLimitBucket | null] {
  if (!buckets?.length) return [null, null];
  const ordered = [...buckets].sort(
    (left, right) => left.windowDurationMins - right.windowDurationMins,
  );
  const short = ordered[0] ?? null;
  const weekly = ordered.find((bucket) => bucket.windowDurationMins >= 5 * 24 * 60);
  const long = weekly ?? ordered.at(-1) ?? null;
  return [short, long === short ? null : long];
}

export function compactBucketLabel(bucket: RateLimitBucket | null, index: number): string {
  if (index === 0) return bucket?.windowDurationMins === 300 ? "5h" : "short";
  return bucket && bucket.windowDurationMins >= 5 * 24 * 60 ? "weekly" : "long";
}

export interface PetResourceBarViewModel {
  kind: "hp" | "mp";
  label: "HP" | "MP";
  value: number | null;
  detail: string;
}

function boundedPercent(bucket: RateLimitBucket | null): number | null {
  if (!bucket || !Number.isFinite(bucket.remainingPercent)) return null;
  return Math.min(100, Math.max(0, Math.round(bucket.remainingPercent)));
}

export function buildPetResourceBars(
  buckets: RateLimitBucket[] | null,
): [PetResourceBarViewModel, PetResourceBarViewModel] {
  const [short, long] = selectCompactBuckets(buckets);
  return [
    { kind: "hp", label: "HP", value: boundedPercent(short), detail: compactBucketLabel(short, 0) },
    { kind: "mp", label: "MP", value: boundedPercent(long), detail: compactBucketLabel(long, 1) },
  ];
}

export interface BattleHudBarViewModel {
  kind: "five-hour" | "weekly";
  label: "5H" | "WEEKLY";
  value: number;
}

export interface BattleHudViewModel {
  model: string;
  reasoningEffort: string;
  bars: BattleHudBarViewModel[];
  tokens: string;
}

function compactTokens(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return "--";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function displayAgentLabel(value: string | null | undefined, fallback: string): string {
  const safe = value
    ?.trim()
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 24);
  return (safe || fallback).toUpperCase();
}

export function buildBattleHudViewModel(input: {
  buckets: RateLimitBucket[] | null;
  model: string | null | undefined;
  reasoningEffort: string | null | undefined;
  currentTokens: number | null | undefined;
  contextWindowTokens: number | null | undefined;
}): BattleHudViewModel {
  const fiveHour = input.buckets?.find((bucket) => bucket.windowDurationMins === 300) ?? null;
  const weekly = input.buckets?.find((bucket) => bucket.windowDurationMins >= 5 * 24 * 60) ?? null;
  const bars: BattleHudBarViewModel[] = [];
  const fiveHourValue = boundedPercent(fiveHour);
  const weeklyValue = boundedPercent(weekly);
  if (fiveHourValue !== null) bars.push({ kind: "five-hour", label: "5H", value: fiveHourValue });
  if (weeklyValue !== null) bars.push({ kind: "weekly", label: "WEEKLY", value: weeklyValue });
  return {
    model: displayAgentLabel(input.model, "CODEX"),
    reasoningEffort: displayAgentLabel(input.reasoningEffort, "--"),
    bars,
    tokens: `${compactTokens(input.currentTokens)} / ${compactTokens(input.contextWindowTokens)}`,
  };
}
