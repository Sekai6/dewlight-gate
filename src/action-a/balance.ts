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

/** Allocation-free two-link arm solver; a fixed elbow side cannot flip at extension. */
export function solveArm(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  upper: number,
  lower: number,
  out: {
    elbowX: number;
    elbowY: number;
    x: number;
    y: number;
    direction: number;
  },
  ready: boolean,
) {
  const dx = tx - sx,
    dy = ty - sy;
  const distance = Math.hypot(dx, dy);
  let angle =
    distance > 0.5 ? Math.atan2(dy, dx) : ready ? out.direction : Math.PI / 2;
  if (ready)
    angle =
      out.direction +
      Math.atan2(
        Math.sin(angle - out.direction),
        Math.cos(angle - out.direction),
      );
  const reach = clamp(
    distance,
    Math.abs(upper - lower) + 0.5,
    upper + lower - 0.25,
  );
  const bend = Math.acos(
    clamp(
      (upper * upper + reach * reach - lower * lower) / (2 * upper * reach),
      -1,
      1,
    ),
  );
  out.direction = angle;
  out.elbowX = sx + Math.cos(angle - bend) * upper;
  out.elbowY = sy + Math.sin(angle - bend) * upper;
  out.x = sx + Math.cos(angle) * reach;
  out.y = sy + Math.sin(angle) * reach;
  return out;
}
