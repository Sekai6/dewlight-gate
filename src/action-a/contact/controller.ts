import { clamp } from "../core.ts";
import {
  limbError,
  solveArm,
  solveLimb,
  type ArmSolution,
  type LimbSolution,
} from "../ik.ts";
export interface ContactRequest {
  id: string;
  kind: "grip" | "foot" | "brace" | "inertia";
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  upper: number;
  lower: number;
  bend: number;
  weight: number;
  valid: boolean;
  surfaceId?: string | number;
  surfaceX?: number;
  surfaceY?: number;
  left?: number;
  right?: number;
  /** Solve as an arm with elbow-side memory held in this object. */
  arm?: ArmSolution;
  ready?: boolean;
  freeX?: number;
  freeY?: number;
}
export interface ContactState {
  id: string;
  phase: "enter" | "hold" | "release";
  weight: number;
  reason: string;
  localX: number;
  localY: number;
  surfaceId?: string | number;
}
export interface ContactResult extends LimbSolution {
  error: number;
  state: ContactState;
}
export const CONTACT_PRIORITY = {
  grip: 0,
  foot: 1,
  brace: 2,
  inertia: 3,
} as const;
export class ContactController {
  private owners = new Map<string, number>();
  beginFrame() {
    this.owners.clear();
  }

  endFrame(dt: number) {
    if (dt <= 0) return;
    for (const [id, result] of this.slots)
      if (!this.owners.has(id)) {
        result.state.phase = "release";
        result.state.reason = "inactive";
        result.state.weight = Math.max(0, result.state.weight - dt / 0.08);
      }
  }

  private slots = new Map<string, ContactResult>();
  reset() {
    this.slots.clear();
    this.owners.clear();
  }
  snapshot() {
    return [...this.slots.values()].map((v) => ({
      ...v,
      state: { ...v.state },
    }));
  }
  solve(request: ContactRequest, dt: number) {
    const owner = this.owners.get(request.id);
    const priority = CONTACT_PRIORITY[request.kind];
    const existing = this.slots.get(request.id);
    if (existing && owner !== undefined && owner < priority) return existing;
    this.owners.set(request.id, priority);
    let result = this.slots.get(request.id);
    if (!result) {
      result = {
        jointX: 0,
        jointY: 0,
        x: 0,
        y: 0,
        error: 0,
        state: {
          id: request.id,
          phase: "enter",
          weight: 0,
          reason: "",
          localX: 0,
          localY: 0,
        },
      };
      this.slots.set(request.id, result);
    }
    const s = result.state,
      reach = request.upper + request.lower;
    const distance = Math.hypot(
      request.x - request.anchorX,
      request.y - request.anchorY,
    );
    const edge =
      (request.left !== undefined && request.x < request.left) ||
      (request.right !== undefined && request.x > request.right);
    const valid =
      request.valid &&
      !edge &&
      (request.kind === "grip" || distance <= reach + 0.1);
    s.reason = !request.valid
      ? "inactive"
      : edge
        ? "edge"
        : !valid
          ? "unreachable"
          : "";
    s.phase = valid ? (s.weight >= 0.99 ? "hold" : "enter") : "release";
    s.weight = valid
      ? clamp(request.weight)
      : Math.max(0, s.weight - dt / 0.08);
    s.surfaceId = request.surfaceId;
    s.localX = request.x - (request.surfaceX ?? 0);
    s.localY = request.y - (request.surfaceY ?? 0);
    const x = valid ? request.x : (request.freeX ?? request.x),
      y = valid ? request.y : (request.freeY ?? request.y);
    if (request.arm) {
      const arm = solveArm(
        request.anchorX,
        request.anchorY,
        x,
        y,
        request.upper,
        request.lower,
        request.arm,
        !!request.ready,
      );
      result.jointX = arm.jointX;
      result.jointY = arm.jointY;
      result.x = arm.x;
      result.y = arm.y;
      result.error = 0;
      return result;
    }
    solveLimb(
      request.anchorX,
      request.anchorY,
      x,
      y,
      request.upper,
      request.lower,
      request.bend,
      result,
    );
    result.error = limbError(
      request.anchorX,
      request.anchorY,
      result,
      request.upper,
      request.lower,
    );
    return result;
  }
}
