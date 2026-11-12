import { clamp } from "../core.ts";
export interface ImpulseDefinition {
  gain: number;
  delay: number;
  stiffness: number;
  damping: number;
  limit: number;
}
export interface ImpulseInput {
  clock: number;
  action: string;
  age: number;
  instance?: string | number;
  vx: number;
  facing: number;
  landingSpeed?: number;
  grounded: boolean;
  hitDirection?: number;
  doll?: { active: boolean };
  reduced?: boolean;
}
export interface ImpulseState {
  value: number;
  velocity: number;
}
export interface ImpulseOutput {
  hip: number;
  chest: number;
  shoulder: number;
  head: number;
  ornament: number;
}
export const IMPULSE_CHANNELS: readonly ImpulseDefinition[] = [
  { gain: 1.6, delay: 0, stiffness: 420, damping: 34, limit: 2.4 },
  { gain: 0.075, delay: 0.008, stiffness: 480, damping: 30, limit: 0.12 },
  { gain: 0.09, delay: 0.016, stiffness: 520, damping: 32, limit: 0.16 },
  { gain: -0.045, delay: 0.024, stiffness: 360, damping: 26, limit: 0.08 },
  { gain: 0.12, delay: 0.04, stiffness: 180, damping: 18, limit: 0.22 },
];
export class ImpulseController {
  readonly states: ImpulseState[] = IMPULSE_CHANNELS.map(() => ({
    value: 0,
    velocity: 0,
  }));
  readonly output: ImpulseOutput = {
    hip: 0,
    chest: 0,
    shoulder: 0,
    head: 0,
    ornament: 0,
  };
  private last: ImpulseInput | null = null;
  private eventAt = -999;
  private strength = 0;
  private identity: string | number | undefined;
  private seen: (string | number)[] = [];
  events = 0;
  reset() {
    this.states.forEach((s) => {
      s.value = s.velocity = 0;
    });
    Object.assign(this.output, {
      hip: 0,
      chest: 0,
      shoulder: 0,
      head: 0,
      ornament: 0,
    });
    this.last = null;
    this.identity = undefined;
    this.seen.length = 0;
    this.eventAt = -999;
    this.strength = 0;
    this.events = 0;
  }
  /** `gain` scales the whole chain for heavier or lighter bodies. */
  /** `strength` is set when the current action fires an impulse per instance. */
  update(input: ImpulseInput, gain = 1, strength?: number) {
    const previous = this.last,
      dt = previous ? clamp(input.clock - previous.clock, 0, 0.25) : 0;
    if (previous && dt === 0) return this.output;
    const identity =
      input.instance ??
      `${input.action}:${(input.clock - input.age).toFixed(4)}`;
    const transient = strength !== undefined;
    if (
      transient &&
      identity !== this.identity &&
      !this.seen.includes(identity)
    ) {
      this.seen.push(identity);
      if (this.seen.length > 32) this.seen.shift();
      this.identity = identity;
      this.eventAt = input.clock - input.age;
      this.strength = strength ?? 1;
      this.events++;
    } else if (
      previous &&
      Math.abs(previous.vx) > 30 &&
      Math.abs(input.vx) <= 5
    ) {
      this.eventAt = input.clock;
      this.strength = -Math.sign(previous.vx * input.facing);
      this.events++;
    } else if (previous && !previous.grounded && input.grounded) {
      this.eventAt = input.clock;
      this.strength = clamp((input.landingSpeed ?? 0) / 650, 0, 1);
      this.events++;
    }
    const acceleration =
      previous && dt > 0
        ? clamp(((input.vx - previous.vx) * input.facing) / dt / 1800, -1, 1)
        : 0;
    for (let remaining = dt; remaining > 1e-8;) {
      const h = Math.min(remaining, 1 / 120);
      remaining -= h;
      const time = input.clock - remaining;
      for (let i = 0; i < this.states.length; i++) {
        const config = IMPULSE_CHANNELS[i],
          state = this.states[i],
          age = time - this.eventAt - config.delay;
        const pulse =
          age < 0
            ? 0
            : Math.sin(Math.min(age / 0.16, 1) * Math.PI) * Math.exp(-age * 5);
        const target = input.doll?.active
          ? 0
          : (pulse * this.strength + acceleration * 0.45) * config.gain * gain;
        state.velocity += (target - state.value) * config.stiffness * h;
        state.velocity *= Math.exp(-config.damping * h);
        state.value = clamp(
          state.value + state.velocity * h,
          -config.limit,
          config.limit,
        );
      }
    }
    this.output.hip = this.states[0].value;
    this.output.chest = this.states[1].value;
    this.output.shoulder = this.states[2].value;
    this.output.head = this.states[3].value;
    this.output.ornament = this.states[4].value;
    if (input.reduced) this.output.ornament = 0;
    if (!this.last) this.last = { ...input };
    else Object.assign(this.last, input);
    return this.output;
  }
}
