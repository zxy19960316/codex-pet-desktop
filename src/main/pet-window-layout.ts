import { computePetVisualMetrics } from "../core/pet/pet-display";

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PetWindowAnchor = "left-bottom" | "right-bottom" | "free";

export interface ComputePetWindowBoundsInput {
  frameWidth: number;
  frameHeight: number;
  scalePercent: number;
  physicalScaleFactor?: number;
  expanded: boolean;
  currentBounds: Rectangle;
  displayWorkArea: Rectangle;
  anchor?: PetWindowAnchor;
}

const EDGE_TOLERANCE = 48;
const CHROME = {
  compact: { minimumWidth: 168, minimumHeight: 220, extraWidth: 48, extraHeight: 124 },
  expanded: { minimumWidth: 420, minimumHeight: 700, extraWidth: 228, extraHeight: 508 },
} as const;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function inferPetWindowAnchor(
  currentBounds: Rectangle,
  workArea: Rectangle,
): PetWindowAnchor {
  const nearBottom =
    Math.abs(currentBounds.y + currentBounds.height - (workArea.y + workArea.height)) <=
    EDGE_TOLERANCE;
  if (!nearBottom) return "free";
  if (Math.abs(currentBounds.x - workArea.x) <= EDGE_TOLERANCE) return "left-bottom";
  if (
    Math.abs(currentBounds.x + currentBounds.width - (workArea.x + workArea.width)) <=
    EDGE_TOLERANCE
  )
    return "right-bottom";
  return "free";
}

export function computePetWindowBounds(input: ComputePetWindowBoundsInput): Rectangle {
  const workArea = {
    x: finite(input.displayWorkArea.x, 0),
    y: finite(input.displayWorkArea.y, 0),
    width: Math.max(1, finite(input.displayWorkArea.width, 1)),
    height: Math.max(1, finite(input.displayWorkArea.height, 1)),
  };
  const visual = computePetVisualMetrics(
    input.frameWidth,
    input.frameHeight,
    input.scalePercent,
    input.physicalScaleFactor,
  );
  const chrome = input.expanded ? CHROME.expanded : CHROME.compact;
  const width = Math.min(
    workArea.width,
    Math.max(chrome.minimumWidth, visual.width + chrome.extraWidth),
  );
  const height = Math.min(
    workArea.height,
    Math.max(chrome.minimumHeight, visual.height + chrome.extraHeight),
  );
  const current = {
    x: finite(input.currentBounds.x, workArea.x),
    y: finite(input.currentBounds.y, workArea.y),
    width: Math.max(1, finite(input.currentBounds.width, width)),
    height: Math.max(1, finite(input.currentBounds.height, height)),
  };
  const anchor = input.anchor ?? inferPetWindowAnchor(current, workArea);
  let x: number;
  let y: number;
  if (anchor === "right-bottom") {
    x = workArea.x + workArea.width - width;
    y = workArea.y + workArea.height - height;
  } else if (anchor === "left-bottom") {
    x = workArea.x;
    y = workArea.y + workArea.height - height;
  } else {
    x = current.x + current.width / 2 - width / 2;
    y = current.y + current.height / 2 - height / 2;
  }
  return {
    x: Math.round(clamp(x, workArea.x, workArea.x + workArea.width - width)),
    y: Math.round(clamp(y, workArea.y, workArea.y + workArea.height - height)),
    width: Math.round(width),
    height: Math.round(height),
  };
}
