import { ATTACKS, REACTIONS, attackPhase } from "../actions.ts";
import { clamp } from "../core.ts";
export interface IntentTarget {
  id: string;
  x: number;
  y: number;
  threat: boolean;
  valid?: boolean;
}
export interface IntentInput {
  clock: number;
  x: number;
  y: number;
  facing: number;
  vx: number;
  action: string;
  age: number;
  target?: IntentTarget;
  lockedDirection?: number;
  suppressed?: boolean;
}
export interface IntentState {
  head: number;
  chest: number;
  targetId: string | null;
}
export type IntentOutput = IntentState;
export class IntentSelector {
  private selected: IntentTarget | undefined;
  private since = -999;
  reset() {
    this.selected = undefined;
    this.since = -999;
  }
  choose(
    clock: number,
    x: number,
    y: number,
    facing: number,
    candidates: readonly IntentTarget[],
  ) {
    const valid = candidates.filter(
      (t) =>
        t.valid !== false &&
        (t.x - x) * facing >= 0 &&
        Math.hypot(t.x - x, t.y - y) <= 360 &&
        Math.abs(t.y - y) <= 120,
    );
    valid.sort(
      (a, b) =>
        Number(b.threat) - Number(a.threat) ||
        Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y) ||
        a.id.localeCompare(b.id),
    );
    const current = valid.find((t) => t.id === this.selected?.id),
      best = valid[0];
    if (
      !current ||
      (best && best.threat && !current.threat) ||
      (best &&
        best.threat === current.threat &&
        clock - this.since >= 0.35 &&
        Math.hypot(best.x - x, best.y - y) <
          Math.hypot(current.x - x, current.y - y) * 0.75)
    ) {
      if (best?.id !== this.selected?.id) this.since = clock;
      this.selected = best;
    } else this.selected = current;
    return this.selected;
  }
}
export class IntentController {
  readonly state: IntentState = { head: 0, chest: 0, targetId: null };
  private clock = -999;
  private moving = false;
  private stoppedAt = -999;
  private lastMove = 0;
  reset() {
    Object.assign(this.state, { head: 0, chest: 0, targetId: null });
    this.clock = -999;
    this.moving = false;
    this.stoppedAt = -999;
    this.lastMove = 0;
  }
  /** `limits` are the head and chest ranges in degrees. */
  update(input: IntentInput, limits: readonly [number, number]) {
    if (this.clock === input.clock) return this.state;
    const dt = this.clock < 0 ? 0 : clamp(input.clock - this.clock, 0, 0.25);
    this.clock = input.clock;
    const moving = Math.abs(input.vx) > 5;
    if (this.moving && !moving) this.stoppedAt = input.clock;
    if (moving) this.lastMove = Math.sign(input.vx);
    this.moving = moving;
    const target = input.target,
      front = target && (target.x - input.x) * input.facing >= 0;
    let angle = front
      ? Math.atan2(target.y - input.y, (target.x - input.x) * input.facing)
      : 0;
    if (!target)
      angle =
        0.08 *
        this.lastMove *
        input.facing *
        (moving ? 1 : clamp(1 - (input.clock - this.stoppedAt - 0.25) / 0.2));
    if (input.lockedDirection !== undefined)
      angle = input.lockedDirection === input.facing ? -0.04 : 0;
    const release =
      ATTACKS.has(input.action) && attackPhase(input.age) === "release";
    if (input.suppressed || release || REACTIONS.has(input.action)) angle = 0;
    const [head, chest] = limits;
    for (let remaining = dt; remaining > 1e-8;) {
      const h = Math.min(1 / 120, remaining);
      remaining -= h;
      const w = 1 - Math.exp(-h * 18);
      this.state.head +=
        (clamp(angle, (-head * Math.PI) / 180, (head * Math.PI) / 180) -
          this.state.head) *
        w;
      this.state.chest +=
        (clamp(angle * 0.3, (-chest * Math.PI) / 180, (chest * Math.PI) / 180) -
          this.state.chest) *
        w;
    }
    this.state.targetId = front ? target.id : null;
    return this.state;
  }
}
