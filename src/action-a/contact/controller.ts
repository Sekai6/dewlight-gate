import { solveArm } from "../balance.ts";
import { clamp } from "../core.ts";
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
  arm?: {
    elbowX: number;
    elbowY: number;
    x: number;
    y: number;
    direction: number;
  };
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
export interface ContactResult {
  jointX: number;
  jointY: number;
  x: number;
  y: number;
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

  /** Resolve a conflicting set by stable priority. One request per limb wins. */
  solveBatch(requests: readonly ContactRequest[], dt: number) {
    const ordered = [...requests].sort(
      (a, b) =>
        CONTACT_PRIORITY[a.kind] - CONTACT_PRIORITY[b.kind] ||
        a.id.localeCompare(b.id),
    );
    this.beginFrame();
    const occupied = new Set<string>();
    return ordered.map((request) => {
      if (occupied.has(request.id)) {
        const winner = this.slots.get(request.id)!;
        return {
          ...winner,
          state: {
            ...winner.state,
            phase: "release" as const,
            reason: "priority",
            weight: 0,
          },
        };
      }
      const result = this.solve(request, dt);
      if (request.valid) occupied.add(request.id);
      return { ...result, state: { ...result.state } };
    });
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
      Object.assign(result, {
        jointX: arm.elbowX,
        jointY: arm.elbowY,
        x: arm.x,
        y: arm.y,
        error: 0,
      });
      return result;
    }
    // Reuse the slot: no temporary knee/foot objects in the hot solver.
    const dx = x - request.anchorX,
      dy = y - request.anchorY;
    const clampedDistance = clamp(
      Math.hypot(dx, dy),
      Math.abs(request.upper - request.lower) + 1e-5,
      request.upper + request.lower - 1e-5,
    );
    const angle = Math.atan2(dy, dx);
    const offset = Math.acos(
      clamp(
        (request.upper * request.upper +
          clampedDistance * clampedDistance -
          request.lower * request.lower) /
          (2 * request.upper * clampedDistance),
        -1,
        1,
      ),
    );
    const jointAngle = angle + offset * request.bend;
    result.jointX = request.anchorX + Math.cos(jointAngle) * request.upper;
    result.jointY = request.anchorY + Math.sin(jointAngle) * request.upper;
    result.x = request.anchorX + Math.cos(angle) * clampedDistance;
    result.y = request.anchorY + Math.sin(angle) * clampedDistance;
    result.error = Math.max(
      Math.abs(
        Math.hypot(
          result.jointX - request.anchorX,
          result.jointY - request.anchorY,
        ) - request.upper,
      ),
      Math.abs(
        Math.hypot(result.x - result.jointX, result.y - result.jointY) -
          request.lower,
      ),
    );
    return result;
  }
}
