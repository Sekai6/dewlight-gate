import { clamp } from "./core.ts";

/** Result of a two-bone solve: the middle joint and the clamped end point. */
export interface LimbSolution {
  jointX: number;
  jointY: number;
  x: number;
  y: number;
}
/** An arm additionally remembers its aim so the elbow side cannot flip. */
export interface ArmSolution extends LimbSolution {
  direction: number;
}

/** The one two-bone kernel: law of cosines around a given aim and reach. */
function place(
  x: number,
  y: number,
  angle: number,
  reach: number,
  upper: number,
  lower: number,
  bend: number,
  out: LimbSolution,
) {
  const offset = Math.acos(
    clamp(
      (upper * upper + reach * reach - lower * lower) / (2 * upper * reach),
      -1,
      1,
    ),
  );
  const joint = angle + offset * bend;
  out.jointX = x + Math.cos(joint) * upper;
  out.jointY = y + Math.sin(joint) * upper;
  out.x = x + Math.cos(angle) * reach;
  out.y = y + Math.sin(angle) * reach;
  return out;
}

/** Allocation-free two-bone IK. Unreachable targets clamp along the aim line;
 *  `bend` (+1/-1) picks the joint side. */
export function solveLimb<T extends LimbSolution>(
  x: number,
  y: number,
  tx: number,
  ty: number,
  upper: number,
  lower: number,
  bend: number,
  out: T,
) {
  const dx = tx - x,
    dy = ty - y;
  const reach = clamp(
    Math.hypot(dx, dy),
    Math.abs(upper - lower) + 1e-5,
    upper + lower - 1e-5,
  );
  place(x, y, Math.atan2(dy, dx), reach, upper, lower, bend, out);
  return out;
}

/** Arm variant: the aim is unwrapped against the previous solve (`ready`), so
 *  the elbow keeps its side through full extension and degenerate targets. */
export function solveArm(
  x: number,
  y: number,
  tx: number,
  ty: number,
  upper: number,
  lower: number,
  out: ArmSolution,
  ready: boolean,
) {
  const dx = tx - x,
    dy = ty - y;
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
  out.direction = angle;
  place(x, y, angle, reach, upper, lower, -1, out);
  return out;
}

/** Largest deviation of either segment from its rigid length. */
export function limbError(
  x: number,
  y: number,
  limb: LimbSolution,
  upper: number,
  lower: number,
) {
  return Math.max(
    Math.abs(Math.hypot(limb.jointX - x, limb.jointY - y) - upper),
    Math.abs(Math.hypot(limb.x - limb.jointX, limb.y - limb.jointY) - lower),
  );
}
