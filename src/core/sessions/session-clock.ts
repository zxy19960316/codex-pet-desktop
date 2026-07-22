import { ACTIVE_SESSION_STATES, type AgentSessionState } from "./session-types";

export const MAX_ACTIVE_OBSERVATION_MS = 90_000;

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function sessionElapsedMs(startedAt: number, now: number): number {
  return finiteNonNegative(now - startedAt);
}

export function turnElapsedMs(
  startedAt: number,
  turnStartedAt: number | undefined,
  now: number,
): number | undefined {
  return turnStartedAt === undefined
    ? undefined
    : finiteNonNegative(now - Math.max(startedAt, turnStartedAt));
}

export function accumulateActiveWork(
  activeWorkMs: number,
  state: AgentSessionState,
  lastActivityAt: number,
  timestamp: number,
): number {
  if (!ACTIVE_SESSION_STATES.has(state)) return finiteNonNegative(activeWorkMs);
  const elapsed = Math.min(
    MAX_ACTIVE_OBSERVATION_MS,
    finiteNonNegative(timestamp - lastActivityAt),
  );
  return finiteNonNegative(activeWorkMs) + elapsed;
}

export interface ActiveInterval {
  start: number;
  end: number;
}

export function unionActiveIntervals(intervals: readonly ActiveInterval[]): number {
  const normalized = intervals
    .map(({ start, end }) => ({ start: finiteNonNegative(start), end: finiteNonNegative(end) }))
    .filter(({ start, end }) => end > start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let total = 0;
  let current: ActiveInterval | undefined;
  for (const interval of normalized) {
    if (!current || interval.start > current.end) {
      if (current) total += current.end - current.start;
      current = { ...interval };
    } else current.end = Math.max(current.end, interval.end);
  }
  return total + (current ? current.end - current.start : 0);
}
