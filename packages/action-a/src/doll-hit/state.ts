/** One hit. `kind` names a profile given to the controller. */
export interface HitContext<Kind extends string = string> {
  kind: Kind;
  sourceX: number;
  sourceY: number;
  direction: number;
  instance: string;
}
export interface DollHitProfile {
  horizontal: number;
  upward: number;
  /** Seconds before a recovery input is honoured. */
  lock: number;
  bounces: number;
  /** Tumble speed at launch, radians per second. */
  spin: number;
  /** Share of the landing speed returned by the first and later bounces. */
  restitution: readonly [number, number];
  /** Heavy hits end flat on the ground; light ones only stagger. */
  lie: boolean;
}
/** Seconds spent in each phase, and the limits around them. */
export const DOLL_TIMING = {
  impact: 0.065,
  bounce: 0.06,
  roll: 0.26,
  rollGround: 0.06,
  rise: 0.28,
  recover: 0.12,
  /** A mid-air recovery finishes its turn as a tucked flip. */
  recoverAir: 0.2,
  /** A recovery press is remembered this long. */
  buffer: 0.12,
  /** The body gets up by itself at `timeout` and is always free by `limit`. */
  timeout: 2.08,
  limit: 2.2,
} as const;
export type DollPhase =
  "idle" | "impact" | "air" | "bounce" | "roll" | "rise" | "recover" | "down";
export interface DollHitState {
  active: boolean;
  kind: string;
  /** The hit lays the body flat; otherwise it only staggers. */
  lie: boolean;
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
  /** Current tumble speed, radians per second, signed. */
  spin: number;
  /** `age` of the latest floor or wall impact, and how hard it was (0..1). */
  impactAt: number;
  impact: number;
  /** Never gets up: comes to rest in the `down` phase until reset. */
  stay: boolean;
}
const fresh = (): DollHitState => ({
  active: false,
  kind: "",
  lie: false,
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
  spin: 0,
  impactAt: -1,
  impact: 0,
  stay: false,
});
const TURN = Math.PI * 2;
/** A sliding body turns as if it were a wheel of this radius. */
const ROLL_RADIUS = 30;
const smooth = (u: number) => u * u * (3 - 2 * u);

/** Game-time state only. The caller owns position, terrain and HP. */
export class DollHitController<Kind extends string = string> {
  readonly state = fresh();
  readonly profiles: Readonly<Record<Kind, DollHitProfile>>;
  constructor(profiles: Readonly<Record<Kind, DollHitProfile>>) {
    this.profiles = profiles;
  }
  private bufferedAt = -999;
  private recoveryAngle = 0;
  private recoveryTarget = 0;
  private recoveryTime = 0;
  private restAngle = 0;
  reset() {
    Object.assign(this.state, fresh());
    this.clearBuffer();
  }
  clearBuffer() {
    this.bufferedAt = -999;
  }
  start(hit: HitContext<Kind>, stay = false): boolean {
    if (this.state.active || this.state.instance === hit.instance) return false;
    const direction = Math.sign(hit.direction) || 1;
    Object.assign(this.state, fresh(), {
      active: true,
      kind: hit.kind,
      lie: this.profiles[hit.kind].lie,
      instance: hit.instance,
      direction,
      phase: "impact",
      spin: this.profiles[hit.kind].spin * direction,
      stay,
    });
    this.clearBuffer();
    return true;
  }
  get profile() {
    return this.profiles[this.state.kind as Kind];
  }
  private phase(phase: DollPhase) {
    this.state.phase = phase;
    this.state.phaseAge = 0;
  }
  private struck(speed: number) {
    this.state.impactAt = this.state.age;
    this.state.impact = Math.min(1, Math.abs(speed) / 600);
  }
  private getUp(phase: "rise" | "recover", grounded: boolean) {
    const s = this.state,
      turns = s.angle / TURN;
    this.recoveryAngle = s.angle;
    const flip = phase === "recover" && !grounded;
    this.recoveryTime = flip ? DOLL_TIMING.recoverAir : DOLL_TIMING[phase];
    // In the air the body completes the turn it is in; on the ground it
    // takes the shorter way up.
    this.recoveryTarget =
      (flip
        ? (Math.sign(s.spin) || s.direction) > 0
          ? Math.ceil(turns - 0.15)
          : Math.floor(turns + 0.15)
        : Math.round(turns)) * TURN;
    this.phase(phase);
  }
  requestRecovery() {
    if (this.state.active && !this.state.stay) this.bufferedAt = this.state.age;
  }
  /** `vx` couples the tumble to travel: a body that slows or rebounds turns
   *  accordingly, and on the ground it rolls with the distance covered. */
  tick(dt: number, grounded: boolean, vx?: number) {
    if (!this.state.active || dt <= 0) return;
    const s = this.state,
      T = DOLL_TIMING;
    // Same bounded integration path for previews and 10/20/60 fps play.
    let remaining = dt;
    while (remaining > 1e-8 && s.active) {
      const step = Math.min(1 / 120, remaining);
      remaining -= step;
      s.age += step;
      s.phaseAge += step;
      if (s.phase === "down") continue;
      const rising = s.phase === "recover" || s.phase === "rise";
      s.recoverReady = s.age + 1e-8 >= this.profile.lock;
      if (
        !s.stay &&
        !rising &&
        ((s.recoverReady && s.age - this.bufferedAt <= T.buffer + 1e-8) ||
          s.age >= T.timeout)
      ) {
        s.recovered = true;
        this.getUp("recover", grounded);
        this.clearBuffer();
      }
      if (s.phase === "impact" && s.phaseAge >= T.impact) this.phase("air");
      if (s.phase === "bounce" && s.phaseAge >= T.bounce) this.phase("air");
      if (
        s.phase === "roll" &&
        s.phaseAge >= (this.profile.lie ? T.roll : T.rollGround)
      ) {
        if (s.stay) {
          s.angle = this.restAngle;
          s.spin = 0;
          this.phase("down");
          continue;
        }
        this.getUp("rise", grounded);
      }
      if (s.phase === "recover" || s.phase === "rise") {
        const u = Math.min(1, s.phaseAge / this.recoveryTime);
        const target = this.recoveryTarget;
        s.angle =
          this.recoveryAngle + (target - this.recoveryAngle) * smooth(u);
        s.weight = 1 - smooth(u);
        s.spin = 0;
        if (u >= 1 - 1e-8 || s.age >= T.limit - 1e-8) {
          s.active = false;
          s.phase = "idle";
          s.weight = 0;
        }
      } else if (s.phase === "roll" && this.profile.lie) {
        // Settle onto the back or the front, whichever is nearer.
        s.weight = 1;
        const before = s.angle;
        s.angle += (this.restAngle - s.angle) * (1 - Math.exp(-step * 18));
        s.spin = (s.angle - before) / step;
      } else {
        s.weight = Math.min(1, s.age / 0.055);
        if (vx === undefined) s.spin *= Math.exp(-step * (grounded ? 3 : 0.45));
        else {
          const wanted = grounded
            ? vx / ROLL_RADIUS
            : (vx / this.profile.horizontal) * this.profile.spin;
          s.spin +=
            (wanted - s.spin) * (1 - Math.exp(-step * (grounded ? 14 : 3)));
        }
        const turn = Math.min(
          Math.abs(s.spin) * step,
          Math.PI * 4 - s.turnTotal,
        );
        s.angle += turn * Math.sign(s.spin);
        s.turnTotal += turn;
      }
    }
  }
  /** Returns new vertical velocity. Contact must be reported only on a downward crossing. */
  land(speed: number): number {
    const s = this.state;
    if (!s.active || s.phase === "recover" || s.phase === "rise") return 0;
    if (s.phase === "down" || s.phase === "roll") return 0;
    this.struck(speed);
    if (s.bounces < this.profile.bounces && speed > 100 && s.age < 1.5) {
      const bounce = speed * this.profile.restitution[s.bounces ? 1 : 0];
      s.bounces++;
      // The floor takes most of the tumble.
      s.spin *= 0.55;
      this.phase("bounce");
      return -bounce;
    }
    this.restAngle = this.profile.lie
      ? Math.round((s.angle - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2
      : s.angle;
    this.phase("roll");
    return 0;
  }
  /** The body ran into a wall. Returns new horizontal velocity. */
  wall(vx: number): number {
    const s = this.state;
    if (!s.active || s.phase === "recover" || s.phase === "rise")
      return vx * -0.15;
    if (Math.abs(vx) > 60) this.struck(vx);
    s.spin *= -0.5;
    return vx * -0.4;
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
