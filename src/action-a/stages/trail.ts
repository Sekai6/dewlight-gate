import { combatMotion, sampleWeapon } from "../combat-motion.ts";
import { clamp } from "../core.ts";
import { solveArm, type ArmSolution } from "../ik.ts";
import type { ActorInput, ActorState, Point } from "./state.ts";

export interface TrailSample {
  tip: Point;
  base: Point;
  time: number;
}
const POOL = 24;

/** Stage 9: measure the final blade and record its swept ribbon. The authored
 *  grip path is re-sampled in simulation time, so the arc keeps its shape at
 *  low frame rates instead of collapsing into straight chords. */
export class WeaponTrail {
  /** Ribbon samples in scene coordinates, oldest first. */
  history: TrailSample[] = [];
  tip: Point = { x: 0, y: 0 };
  base: Point = { x: 0, y: 0 };
  /** Blade tip speed in scene units per second. */
  speed = 0;
  private pool: TrailSample[] = Array.from({ length: POOL }, () => ({
    tip: { x: 0, y: 0 },
    base: { x: 0, y: 0 },
    time: 0,
  }));
  private cursor = 0;
  private shoulder: Point = { x: 0, y: 0 };
  private target = { x: 0, y: 0, rotation: 0 };
  private arm: ArmSolution = { jointX: 0, jointY: 0, x: 0, y: 0, direction: 0 };
  constructor(private state: ActorState) {}
  reset() {
    this.history = [];
    this.tip = { x: 0, y: 0 };
    this.base = { x: 0, y: 0 };
    this.speed = 0;
  }
  clear() {
    this.history.length = 0;
  }
  update(
    input: ActorInput,
    previous: ActorInput | null,
    dt: number,
    reacting: boolean,
  ) {
    const { rig, world, parts } = this.state;
    const history = this.history;
    const w = world.weapon;
    // The sword texture's grip sits at .76 of its frame; sample the actual blade axis.
    this.base = this.state.toWorld({ x: w.x, y: w.y });
    const blade = parts.get("weapon");
    const bladeLength = blade
      ? blade.displayHeight * (blade.originY - 3 / blade.frame.cutHeight)
      : 37;
    this.tip = this.state.toWorld({
      x: w.x - w.c * bladeLength,
      y: w.y - w.d * bladeLength,
    });
    const latest = history.at(-1)?.tip ?? this.tip;
    this.speed =
      previous && dt > 0
        ? Math.hypot(this.tip.x - latest.x, this.tip.y - latest.y) / dt
        : 0;
    const sameAttack =
      previous &&
      previous.instance === input.instance &&
      previous.action === input.action &&
      previous.facing === input.facing &&
      !reacting;
    if (!sameAttack || dt > 0.25) history.length = 0;
    const motion = combatMotion(input.action);
    if (rig.armed && motion && !input.reduced && !reacting) {
      // Interpolated shoulder anchors follow the already constrained body, not
      // a straight line between blade tips.
      const [start, finish] = motion.trail;
      const lengths = rig.arms.front;
      const shoulder = world.arm;
      const from = sameAttack ? Math.max(start, input.age - dt) : input.age;
      const end = Math.min(input.age, finish);
      const count = Math.min(18, Math.max(1, Math.ceil((end - from) * 120)));
      for (let i = 0; i <= count && from <= end; i++) {
        const age = from + ((end - from) * i) / count;
        const u = dt > 0 ? clamp(1 - (input.age - age) / dt) : 1;
        const sx = sameAttack
          ? this.shoulder.x + (shoulder.x - this.shoulder.x) * u
          : shoulder.x;
        const sy = sameAttack
          ? this.shoulder.y + (shoulder.y - this.shoulder.y) * u
          : shoulder.y;
        sampleWeapon(motion, age, this.target, this.state.airWeight);
        const arm = solveArm(
          sx,
          sy,
          sx + this.target.x,
          sy + this.target.y,
          lengths.upper,
          lengths.lower,
          this.arm,
          false,
        );
        const time = input.clock - (input.age - age);
        if (time <= (history.at(-1)?.time ?? -Infinity)) continue;
        const sample = this.pool[this.cursor++ % POOL];
        const x =
          previous && sameAttack
            ? previous.x + (input.x - previous.x) * u
            : input.x;
        const y =
          previous && sameAttack
            ? previous.y + (input.y - previous.y) * u
            : input.y;
        sample.base.x = x + arm.x * input.facing;
        sample.base.y = y + arm.y;
        sample.tip.x =
          sample.base.x +
          Math.sin(this.target.rotation) * bladeLength * input.facing;
        sample.tip.y =
          sample.base.y - Math.cos(this.target.rotation) * bladeLength;
        // The current endpoint is always the actual final rendered weapon.
        if (Math.abs(age - input.age) < 1e-6) {
          sample.base.x = this.base.x;
          sample.base.y = this.base.y;
          sample.tip.x = this.tip.x;
          sample.tip.y = this.tip.y;
        }
        sample.time = time;
        history.push(sample);
        if (history.length > 20) history.shift();
      }
    }
    this.shoulder.x = world.arm.x;
    this.shoulder.y = world.arm.y;
    while (history.length && input.clock - history[0].time >= 0.13)
      history.shift();
  }
}
