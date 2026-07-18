export interface WheelScaleInput {
  ctrlKey: boolean;
  deltaY: number;
}

export function wheelScaleStep(input: WheelScaleInput): number {
  if (!input.ctrlKey || !Number.isFinite(input.deltaY) || input.deltaY === 0) return 0;
  return input.deltaY < 0 ? 1 : -1;
}
