import { approach } from "../balance.ts";
import { clamp } from "../core.ts";
import { RECOVERY_CANCEL } from "../actions.ts";
import { DOLL_TIMING, type DollHitState } from "../doll-hit/state.ts";
import type { SupportSurface } from "../support/controller.ts";

export type RecoveryPath = "none" | "air" | "slide" | "brace" | "stand";
export interface RecoveryInput {
  clock: number;
  grounded: boolean;
  x: number;
  y: number;
  facing: number;
  action: string;
  doll?: Readonly<DollHitState>;
  support?: SupportSurface;
  shoulder?: { x: number; y: number };
  /** How far the bracing hand can be from the shoulder. */
  reach: number;
}
export interface RecoveryState {
  instance: string;
  path: RecoveryPath;
  active: boolean;
  progress: number;
  remaining: number;
  weight: number;
  releaseAt: number;
}
export interface RecoveryOutput {
  state: RecoveryState;
  hand: { x: number; y: number; weight: number };
  crouch: number;
  tuck: number;
}
/** Seconds the crouch lingers after the ragdoll releases. */
const FADE = 0.12;
/** A visual observer of DOLL-HIT. It cannot extend control lock or change physics. */
export class RecoveryController {
  readonly state: RecoveryState = {
    instance: "",
    path: "none",
    active: false,
    progress: 0,
    remaining: 0,
    weight: 0,
    releaseAt: -999,
  };
  readonly output: RecoveryOutput = {
    state: this.state,
    hand: { x: 0, y: 0, weight: 0 },
    crouch: 0,
    tuck: 0,
  };
  private clock = -999;
  private wasDoll = false;
  private releaseWeight = 0;
  reset() {
    Object.assign(this.state, {
      instance: "",
      path: "none",
      active: false,
      progress: 0,
      remaining: 0,
      weight: 0,
      releaseAt: -999,
    });
    this.wasDoll = false;
    this.releaseWeight = 0;
    this.clock = -999;
    this.output.hand.weight = this.output.crouch = this.output.tuck = 0;
  }
  update(input: RecoveryInput) {
    const start = this.clock;
    if (start < 0 || input.clock - start <= 1 / 120 + 1e-8)
      return this.sample(input);
    const d = input.doll;
    const sample = { ...input, doll: d ? { ...d } : undefined };
    let time = start;
    while (time < input.clock - 1e-8) {
      time = Math.min(input.clock, time + 1 / 120);
      sample.clock = time;
      if (d && sample.doll) {
        sample.doll.phaseAge = Math.max(0, d.phaseAge - (input.clock - time));
        sample.doll.age = Math.max(0, d.age - (input.clock - time));
      }
      this.sample(sample);
    }
    return this.output;
  }
  private sample(input: RecoveryInput) {
    if (input.clock === this.clock) return this.output;
    const dt = this.clock < 0 ? 0 : Math.max(0, input.clock - this.clock);
    this.clock = input.clock;
    const d = input.doll,
      s = this.state;
    if (d?.active && d.instance !== s.instance) {
      this.reset();
      this.clock = input.clock;
      s.instance = d.instance;
    }
    if (this.wasDoll && !d?.active) {
      s.releaseAt = input.clock;
      this.releaseWeight = s.weight;
    }
    this.wasDoll = !!d?.active;
    const recovering =
      !!d?.active && ["roll", "rise", "recover"].includes(d.phase);
    const fade = !d?.active && input.clock - s.releaseAt < FADE;
    s.active = recovering || fade;
    if (fade && RECOVERY_CANCEL.has(input.action)) s.active = false;
    const phase = recovering
      ? DOLL_TIMING[d!.phase as "roll" | "rise" | "recover"]
      : FADE;
    s.remaining = fade
      ? Math.max(0, FADE - (input.clock - s.releaseAt))
      : recovering
        ? Math.max(0, phase - d!.phaseAge)
        : 0;
    s.progress = fade
      ? clamp(1 - s.remaining / FADE)
      : recovering
        ? clamp(d!.phaseAge / phase)
        : 0;
    s.weight = s.active
      ? fade
        ? (1 - s.progress) * this.releaseWeight
        : (d?.weight ?? 0)
      : 0;
    this.output.hand.weight = 0;
    s.path = !s.active
      ? "none"
      : !input.grounded
        ? "air"
        : d?.kind === "ground"
          ? "slide"
          : "stand";
    this.output.crouch = approach(
      this.output.crouch,
      s.active && input.grounded ? 18 * s.weight : 0,
      dt,
      35,
    );
    if (!s.active) this.output.crouch = 0;
    this.output.tuck = s.path === "air" ? s.weight : 0;
    const surface = input.support,
      shoulder = input.shoulder;
    if (
      s.active &&
      input.grounded &&
      surface?.left !== undefined &&
      surface.right !== undefined &&
      shoulder &&
      d?.kind !== "ground"
    ) {
      const x = clamp(shoulder.x, input.x - 20, input.x + 20),
        y = surface.y - 2;
      // Both segments remain rigid; no hand anchor is manufactured over an edge.
      if (
        x >= surface.left + 2 &&
        x <= surface.right - 2 &&
        Math.hypot(x - shoulder.x, y - shoulder.y) <= input.reach
      ) {
        s.path = "brace";
        Object.assign(this.output.hand, { x, y, weight: s.weight });
      }
    }
    return this.output;
  }
}
