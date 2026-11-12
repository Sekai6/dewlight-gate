import type { DollTuning } from "../definition.ts";
import type { ContactController } from "../contact/controller.ts";
import { clamp } from "../core.ts";
import { limbError, solveLimb, type LimbSolution } from "../ik.ts";
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
    out: LimbSolution,
    tuning: DollTuning,
    contacts?: ContactController,
  ) {
    const p = this.output.points[index];
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-8) {
      const h = Math.min(1 / 120, remaining);
      remaining -= h;
      const decay = Math.exp(-h * tuning.damping);
      p.vx = (p.vx + (targetX - p.x) * tuning.stiffness * h) * decay;
      p.vy =
        (p.vy +
          ((targetY - p.y) * tuning.stiffness + tuning.gravity * weight) * h) *
        decay;
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
      const bounded = rest + clamp(delta, -tuning.cone, tuning.cone);
      p.x = anchorX + Math.cos(bounded) * radius;
      p.y = Math.min(floor, anchorY + Math.sin(bounded) * radius);
    }
    const x = targetX + (p.x - targetX) * weight,
      y = targetY + (p.y - targetY) * weight;
    // A knee or elbow never folds into the ground: bend the other way instead.
    solveLimb(anchorX, anchorY, x, y, upper, lower, bend, out);
    if (out.jointY > floor) {
      const low = out.jointY;
      solveLimb(anchorX, anchorY, x, y, upper, lower, -bend, out);
      if (out.jointY < low) bend = -bend;
    }
    const result = contacts?.solve(
      {
        id:
          index === 0 ? "grip" : index === 1 ? "free-hand" : `foot${index - 2}`,
        kind: index === 0 ? "grip" : "inertia",
        anchorX,
        anchorY,
        x,
        y,
        upper,
        lower,
        bend,
        weight,
        valid: true,
      },
      dt,
    );
    if (result) {
      out.jointX = result.jointX;
      out.jointY = result.jointY;
      out.x = result.x;
      out.y = result.y;
    } else solveLimb(anchorX, anchorY, x, y, upper, lower, bend, out);
    this.output.error = Math.max(
      this.output.error,
      limbError(anchorX, anchorY, out, upper, lower),
    );
    return out;
  }
}
