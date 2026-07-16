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
