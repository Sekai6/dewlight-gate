import { clamp } from "./core.ts";

export type FootPhase = "load" | "stance" | "toe-off" | "swing";
export interface SupportProfile {
  enabled: boolean;
  shift: number;
  response: number;
  counterLean: number;
  lift: number;
}
export function footPhase(phase: number, stance: number): FootPhase {
  return phase >= stance
    ? "swing"
    : phase < 0.1
      ? "load"
      : phase > stance - 0.12
        ? "toe-off"
        : "stance";
}
export function supportWeight(phase: number, stance: number) {
  if (phase >= stance) return 0;
  return Math.min(clamp(phase / 0.1), clamp((stance - phase) / 0.12));
}
export function approach(
  current: number,
  target: number,
  dt: number,
  rate: number,
) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * rate));
}
/** Visual balance only. No change to the gameplay position or collision body. */
export function balanceTarget(
  left: number,
  right: number,
  w0: number,
  w1: number,
  acceleration: number,
  facing: number,
  profile: SupportProfile,
) {
  if (!profile.enabled || w0 + w1 < 1e-6) return 0;
  const center = (left * w0 + right * w1) / (w0 + w1);
  return clamp(
    center * 0.32 + acceleration * facing * 0.0012,
    -profile.shift,
    profile.shift,
  );
}
