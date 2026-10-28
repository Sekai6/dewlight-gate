import { clamp, solveIK } from "../core.ts";
export interface DollPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface DollPose {
  rotation: number;
  weight: number;
  error: number;
  points: DollPoint[];
}

/** Four inertial end points with anchored, length-constrained two-link limbs. */
export class DollPoseSolver {
  readonly output: DollPose = {
    rotation: 0,
    weight: 0,
    error: 0,
    points: Array.from({ length: 4 }, () => ({ x: 0, y: 0, vx: 0, vy: 0 })),
  };
  ready = false;
  reset() {
    this.ready = false;
    this.output.weight = this.output.rotation = this.output.error = 0;
  }
  seed(index: number, x: number, y: number, vx: number, vy: number) {
    Object.assign(this.output.points[index], { x, y, vx, vy });
  }
  solve(
    index: number,
    anchorX: number,
    anchorY: number,
    targetX: number,
    targetY: number,
    upper: number,
    lower: number,
    bend: number,
    dt: number,
    weight: number,
    floor: number,
    out: { jointX: number; jointY: number; x: number; y: number },
  ) {
    const p = this.output.points[index];
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-8) {
      const h = Math.min(1 / 120, remaining);
      remaining -= h;
      p.vx = (p.vx + (targetX - p.x) * 100 * h) * Math.exp(-h * 7);
      p.vy =
        (p.vy + ((targetY - p.y) * 100 + 150 * weight) * h) * Math.exp(-h * 7);
      p.x += p.vx * h;
      p.y += p.vy * h;
      // Limit the shoulder/hip cone before enforcing exact segment lengths.
      const rest = Math.atan2(targetY - anchorY, targetX - anchorX);
      const angle = Math.atan2(p.y - anchorY, p.x - anchorX);
      const delta = Math.atan2(Math.sin(angle - rest), Math.cos(angle - rest));
      const radius = clamp(
        Math.hypot(p.x - anchorX, p.y - anchorY),
        Math.abs(upper - lower) + 0.5,
        upper + lower - 0.2,
      );
      const bounded = rest + clamp(delta, -1.25, 1.25);
      p.x = anchorX + Math.cos(bounded) * radius;
      p.y = Math.min(floor, anchorY + Math.sin(bounded) * radius);
    }
    const x = targetX + (p.x - targetX) * weight,
      y = targetY + (p.y - targetY) * weight;
    const ik = solveIK(anchorX, anchorY, x, y, upper, lower, bend);
    out.jointX = ik.knee.x;
    out.jointY = ik.knee.y;
    out.x = ik.foot.x;
    out.y = ik.foot.y;
    this.output.error = Math.max(
      this.output.error,
      Math.abs(Math.hypot(out.jointX - anchorX, out.jointY - anchorY) - upper),
      Math.abs(Math.hypot(out.x - out.jointX, out.y - out.jointY) - lower),
    );
    return out;
  }
}
