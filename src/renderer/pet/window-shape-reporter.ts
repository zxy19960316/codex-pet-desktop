import { useEffect, type RefObject } from "react";
import type { PetAnimationAsset } from "../../core/pet/pet-manifest";
import type { WindowShapeRectangle, WindowShapeRequest } from "../../shared/ipc-contract";

function visibleRectangle(rectangle: DOMRect): WindowShapeRectangle | null {
  const left = Math.max(0, rectangle.left);
  const top = Math.max(0, rectangle.top);
  const right = Math.min(window.innerWidth, rectangle.right);
  const bottom = Math.min(window.innerHeight, rectangle.bottom);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function currentAnimationFrame(element: HTMLElement, animation: PetAnimationAsset): number {
  const position = Number.parseFloat(getComputedStyle(element).backgroundPositionX);
  if (!Number.isFinite(position) || animation.frameWidth <= 0) return 0;
  return Math.min(
    animation.frames - 1,
    Math.max(0, Math.round(Math.abs(position) / animation.frameWidth)),
  );
}

function shapeRequest(
  element: HTMLElement,
  animation: PetAnimationAsset,
): WindowShapeRequest | null {
  const spriteRect = visibleRectangle(element.getBoundingClientRect());
  if (!spriteRect) return null;
  const uiRects = [
    ...document.querySelectorAll<HTMLElement>(
      ".pet-resources, .panel, .approval-card, .reply-card",
    ),
  ]
    .filter((candidate) => {
      const style = getComputedStyle(candidate);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
    })
    .flatMap((candidate) => {
      const rectangle = visibleRectangle(candidate.getBoundingClientRect());
      return rectangle ? [rectangle] : [];
    })
    .slice(0, 32);
  return { frameIndex: currentAnimationFrame(element, animation), spriteRect, uiRects };
}

function requestKey(request: WindowShapeRequest): string {
  const rounded = (value: number) => Math.round(value * 10) / 10;
  return JSON.stringify({
    frameIndex: request.frameIndex,
    spriteRect: Object.fromEntries(
      Object.entries(request.spriteRect).map(([key, value]) => [key, rounded(value)]),
    ),
    uiRects: request.uiRects.map((rectangle) =>
      Object.fromEntries(Object.entries(rectangle).map(([key, value]) => [key, rounded(value)])),
    ),
  });
}

export function useWindowShapeReporter(
  spriteRef: RefObject<HTMLDivElement | null>,
  animation: PetAnimationAsset | undefined,
): void {
  useEffect(() => {
    if (!animation) return;
    let lastKey = "";
    const report = () => {
      const element = spriteRef.current;
      if (!element) return;
      const request = shapeRequest(element, animation);
      if (!request) return;
      const key = requestKey(request);
      if (key === lastKey) return;
      lastKey = key;
      window.codexPet.updateWindowShape(request);
    };
    report();
    const timer = window.setInterval(report, 80);
    window.addEventListener("resize", report);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", report);
    };
  }, [animation, spriteRef]);
}
