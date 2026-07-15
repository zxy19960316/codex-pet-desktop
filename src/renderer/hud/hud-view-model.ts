import type { RateLimitBucket } from "../../core/codex/usage-provider";

export function formatTokenCount(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "Data unavailable"
    : new Intl.NumberFormat().format(value);
}

export function rateLimitLabel(bucket: RateLimitBucket): string {
  return bucket.label ?? `${bucket.windowDurationMins} min window`;
}
