import type { Rectangle } from "electron";

export interface SpriteBitmap {
  width: number;
  height: number;
  pixels: Buffer;
}

export interface ShapeRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PetWindowShapeInput {
  bitmap: SpriteBitmap;
  frame: { width: number; height: number; index: number; row: number };
  spriteRect: ShapeRectangle;
  uiRects: ShapeRectangle[];
}

export interface RenderedWindowShapeInput {
  bitmap: SpriteBitmap;
  captureRect: ShapeRectangle;
  spriteFallbackRect: ShapeRectangle;
  uiRects: ShapeRectangle[];
}

interface SourceRun {
  x: number;
  y: number;
  width: number;
  height: number;
}

function sourceAlphaRuns(input: PetWindowShapeInput): SourceRun[] {
  const { bitmap, frame } = input;
  if (
    bitmap.width <= 0 ||
    bitmap.height <= 0 ||
    bitmap.pixels.length < bitmap.width * bitmap.height * 4 ||
    frame.width <= 0 ||
    frame.height <= 0
  )
    return [];
  const frameX = Math.max(0, Math.floor(frame.index)) * frame.width;
  const frameY = Math.max(0, Math.floor(frame.row)) * frame.height;
  const completed: SourceRun[] = [];
  let active = new Map<string, SourceRun>();
  for (let y = 0; y < frame.height; y += 1) {
    const runs: Array<{ x: number; width: number }> = [];
    let start = -1;
    for (let x = 0; x <= frame.width; x += 1) {
      const imageX = frameX + x;
      const imageY = frameY + y;
      const opaque =
        x < frame.width &&
        imageX >= 0 &&
        imageX < bitmap.width &&
        imageY >= 0 &&
        imageY < bitmap.height &&
        bitmap.pixels[(imageY * bitmap.width + imageX) * 4 + 3] > 16;
      if (opaque && start < 0) start = x;
      if (!opaque && start >= 0) {
        runs.push({ x: start, width: x - start });
        start = -1;
      }
    }
    const next = new Map<string, SourceRun>();
    for (const run of runs) {
      const key = `${run.x}:${run.width}`;
      const previous = active.get(key);
      next.set(
        key,
        previous
          ? { ...previous, height: previous.height + 1 }
          : { x: run.x, y, width: run.width, height: 1 },
      );
    }
    for (const [key, run] of active) if (!next.has(key)) completed.push(run);
    active = next;
  }
  completed.push(...active.values());
  return completed;
}

function integerRectangle(rectangle: ShapeRectangle): Rectangle | null {
  const left = Math.floor(rectangle.x);
  const top = Math.floor(rectangle.y);
  const right = Math.ceil(rectangle.x + rectangle.width);
  const bottom = Math.ceil(rectangle.y + rectangle.height);
  if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top)
    return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function buildPetWindowShape(input: PetWindowShapeInput): Rectangle[] {
  const scaleX = input.spriteRect.width / input.frame.width;
  const scaleY = input.spriteRect.height / input.frame.height;
  const sprite = sourceAlphaRuns(input).flatMap((run) => {
    const rectangle = integerRectangle({
      x: input.spriteRect.x + run.x * scaleX,
      y: input.spriteRect.y + run.y * scaleY,
      width: run.width * scaleX,
      height: run.height * scaleY,
    });
    return rectangle ? [rectangle] : [];
  });
  const ui = input.uiRects.flatMap((candidate) => {
    const rectangle = integerRectangle(candidate);
    return rectangle ? [rectangle] : [];
  });
  return [...sprite, ...ui];
}

export function buildRenderedWindowShape(input: RenderedWindowShapeInput): Rectangle[] {
  const sprite = buildPetWindowShape({
    bitmap: input.bitmap,
    frame: { width: input.bitmap.width, height: input.bitmap.height, index: 0, row: 0 },
    spriteRect: input.captureRect,
    uiRects: [],
  });
  const fallback = integerRectangle(input.spriteFallbackRect);
  const ui = input.uiRects.flatMap((candidate) => {
    const rectangle = integerRectangle(candidate);
    return rectangle ? [rectangle] : [];
  });
  return [...(sprite.length ? sprite : fallback ? [fallback] : []), ...ui];
}
