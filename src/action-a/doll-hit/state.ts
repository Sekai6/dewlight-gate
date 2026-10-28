export type HitKind = "ground" | "flying" | "charge" | "wave";
export interface HitContext {
  kind: HitKind;
  sourceX: number;
  sourceY: number;
  direction: number;
  instance: string;
}
export interface DollHitProfile {
  horizontal: number;
  upward: number;
  lock: number;
  bounces: number;
  spin: number;
}
export const HIT_PROFILES: Record<HitKind, DollHitProfile> = {
  ground: { horizontal: 180, upward: 120, lock: 0.18, bounces: 0, spin: 1.5 },
  flying: { horizontal: 320, upward: 240, lock: 0.3, bounces: 1, spin: 6 },
  charge: { horizontal: 620, upward: 400, lock: 0.3, bounces: 2, spin: 13 },
  wave: { horizontal: 280, upward: 590, lock: 0.3, bounces: 2, spin: 11 },
};
export type DollPhase =
  "idle" | "impact" | "air" | "bounce" | "roll" | "rise" | "recover";
export interface DollHitState {
  active: boolean;
  kind: HitKind;
  instance: string;
  direction: number;
  age: number;
  phaseAge: number;
  phase: DollPhase;
  angle: number;
  turnTotal: number;
  weight: number;
  bounces: number;
  recoverReady: boolean;
  recovered: boolean;
}
const fresh = (): DollHitState => ({
  active: false,
  kind: "ground",
  instance: "",
  direction: 1,
  age: 0,
  phaseAge: 0,
  phase: "idle",
  angle: 0,
  turnTotal: 0,
  weight: 0,
  bounces: 0,
  recoverReady: false,
  recovered: false,
});

/** Game-time state only. The caller owns position, terrain and HP. */
export class DollHitController {
  readonly state = fresh();
  private bufferedAt = -999;
  private recoveryAngle = 0;
  reset() {
    Object.assign(this.state, fresh());
    this.clearBuffer();
  }
  clearBuffer() {
    this.bufferedAt = -999;
  }
  start(hit: HitContext): boolean {
    if (this.state.active || this.state.instance === hit.instance) return false;
    Object.assign(this.state, fresh(), {
      active: true,
      kind: hit.kind,
      instance: hit.instance,
      direction: Math.sign(hit.direction) || 1,
      phase: "impact",
    });
    this.clearBuffer();
    return true;
  }
  get profile() {
    return HIT_PROFILES[this.state.kind];
  }
  private phase(phase: DollPhase) {
    this.state.phase = phase;
    this.state.phaseAge = 0;
  }
  requestRecovery() {
    if (this.state.active) this.bufferedAt = this.state.age;
  }
  tick(dt: number, grounded: boolean) {
    if (!this.state.active || dt <= 0) return;
    // Same bounded integration path for previews and 10/20/60 fps tests.
    let remaining = dt;
    while (remaining > 1e-8 && this.state.active) {
      const step = Math.min(1 / 120, remaining);
      remaining -= step;
      const s = this.state;
      s.age += step;
      s.phaseAge += step;
      s.recoverReady = s.age + 1e-8 >= this.profile.lock;
      if (
        (s.recoverReady && s.age - this.bufferedAt <= 0.12 + 1e-8) ||
        (s.age >= 2.08 && s.phase !== "recover" && s.phase !== "rise")
      ) {
        if (s.phase !== "recover" && s.phase !== "rise") {
          s.recovered = true;
          this.recoveryAngle = s.angle;
          this.phase("recover");
          this.clearBuffer();
        }
      }
      if (s.phase === "impact" && s.phaseAge >= 0.065) this.phase("air");
      if (s.phase === "bounce" && s.phaseAge >= 0.06) this.phase("air");
      if (
        s.phase === "roll" &&
        s.phaseAge >= (s.kind === "ground" ? 0.06 : 0.2)
      ) {
        this.recoveryAngle = s.angle;
        this.phase("rise");
      }
      if (s.phase === "recover" || s.phase === "rise") {
        const duration = s.phase === "recover" ? 0.12 : 0.24;
        const u = Math.min(1, s.phaseAge / duration);
        const target =
          Math.round(this.recoveryAngle / (Math.PI * 2)) * Math.PI * 2;
        s.angle =
          this.recoveryAngle +
          (target - this.recoveryAngle) * u * u * (3 - 2 * u);
        s.weight = 1 - u * u * (3 - 2 * u);
        if (u >= 1 - 1e-8 || s.age >= 2.2 - 1e-8) {
          s.active = false;
          s.phase = "idle";
          s.weight = 0;
        }
      } else {
        s.weight = Math.min(1, s.age / 0.055);
        const speed =
          this.profile.spin * (grounded ? 0.45 : 1) * Math.exp(-s.age * 0.45);
        const turn = Math.min(speed * step, Math.PI * 4 - s.turnTotal);
        s.angle += turn * s.direction;
        s.turnTotal += turn;
      }
    }
  }
  /** Returns new vertical velocity. Contact must be reported only on a downward crossing. */
  land(speed: number): number {
    const s = this.state;
    if (!s.active || s.phase === "recover" || s.phase === "rise") return 0;
    if (s.bounces < this.profile.bounces && speed > 100 && s.age < 1.5) {
      const bounce = speed * (s.bounces === 0 ? 0.32 : 0.18);
      s.bounces++;
      this.phase("bounce");
      return -bounce;
    }
    if (s.phase !== "roll") this.phase("roll");
    return 0;
  }
  drag(vx: number, dt: number, grounded: boolean) {
    return (
      vx *
      Math.exp(
        -dt * (this.state.phase === "recover" ? 18 : grounded ? 11 : 0.65),
      )
    );
  }
}
