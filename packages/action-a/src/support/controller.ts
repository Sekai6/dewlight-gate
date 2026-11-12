import { clamp } from "../core.ts";

import { traitsOf, type MovePose, type RigDefinition } from "../definition.ts";
import {
  approach,
  balanceTarget,
  footPhase,
  supportWeight,
  type FootPhase,
  type SupportProfile,
} from "../balance.ts";
export interface SupportSurface {
  id: string | number;
  x: number;
  y: number;
  left?: number;
  right?: number;
}
export interface SupportState {
  x: number;
  y: number;
  planted: boolean;
  phase: number;
  cycle: number;
  weight: number;
  stage: FootPhase;
  localX: number;
  localY: number;
  surfaceId?: string | number;
}
export interface SupportInput {
  skillPose?: MovePose;
  x: number;
  y: number;
  clock: number;
  vx: number;
  vy?: number;
  facing: number;
  grounded: boolean;
  action: string;
  support?: SupportSurface;
  doll?: { active: boolean };
  enabled: boolean;
  gait: number;
  turnAt: number;
  root: { x: number; y: number; rotation: number };
  feet: readonly { x: number; y: number }[];
  combatWeight: number;
  combatAge: number;
}
export interface SupportOutput {
  targets: { x: number; y: number; stance: boolean }[];
  balanceX: number;
  pelvisY: number;
  chestLean: number;
  mobile: boolean;
  planted: boolean;
  events: { x: number; y: number; time: number; kind: "step" }[];
}
export type SupportRig = RigDefinition;
const contact = (): SupportState => ({
  x: 0,
  y: 0,
  planted: false,
  phase: 1,
  cycle: -1,
  weight: 0,
  stage: "swing",
  localX: 0,
  localY: 0,
});
/** Visual contact solver. Never writes the gameplay root, health or control state. */
export class SupportController {
  readonly contacts = [contact(), contact()];
  readonly output: SupportOutput = {
    targets: [
      { x: 0, y: 0, stance: false },
      { x: 0, y: 0, stance: false },
    ],
    balanceX: 0,
    pelvisY: 0,
    chestLean: 0,
    mobile: false,
    planted: false,
    events: [],
  };
  private stopAt = -999;
  private stopFeet: { x: number; y: number }[] = [];
  private balanceX = 0;
  private skillFoot = { x: 0, y: 0 };
  reset() {
    this.contacts.forEach((c) =>
      Object.assign(c, contact(), { surfaceId: undefined }),
    );
    this.stopAt = -999;
    this.stopFeet = [];
    this.balanceX = 0;
    this.output.balanceX = 0;
    this.output.pelvisY = this.output.chestLean = 0;
    this.output.mobile = this.output.planted = false;
    for (const target of this.output.targets)
      Object.assign(target, { x: 0, y: 0, stance: false });
    this.output.events.length = 0;
  }
  constrainBody(hipX: number, hipY: number, rig: SupportRig) {
    let pelvis = 0;
    if (this.output.planted)
      for (let i = 0; i < 2; i++) {
        const t = this.output.targets[i];
        const dx =
          t.x - hipX - this.output.balanceX - (i ? 1 : -1) * rig.footSpan * 0.6;
        pelvis = Math.max(
          pelvis,
          t.y -
            Math.sqrt(Math.max(1, (rig.leg * 2 - 0.05) ** 2 - dx * dx)) -
            hipY,
        );
      }
    this.output.pelvisY = pelvis;
    this.output.chestLean = -this.output.balanceX * rig.support.counterLean;
    return this.output;
  }
  private sampleFeet = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  update(input: SupportInput, previous: SupportInput | null, rig: SupportRig) {
    if (!previous || input.clock - previous.clock <= 1 / 120 + 1e-8)
      return this.sample(input, previous, rig);
    const duration = input.clock - previous.clock;
    if (duration > 0.25) {
      this.reset();
      return this.sample(input, null, rig);
    }
    const events: SupportOutput["events"] = [];
    const sample = { ...previous, feet: this.sampleFeet };
    const prior = { ...previous, feet: this.sampleFeet };
    for (let i = 0; i < 2; i++)
      Object.assign(this.sampleFeet[i], input.feet[i] ?? { x: 0, y: 0 });
    const startGait =
      input.gait -
      Math.abs(
        input.x -
          previous.x -
          (input.support && previous.support?.id === input.support.id
            ? input.support.x - previous.support.x
            : 0),
      ) /
        rig.stride;
    let elapsed = 0;
    while (elapsed < duration - 1e-8) {
      elapsed = Math.min(duration, elapsed + 1 / 120);
      const u = elapsed / duration;
      Object.assign(sample, input, {
        clock: previous.clock + elapsed,
        x: previous.x + (input.x - previous.x) * u,
        y: previous.y + (input.y - previous.y) * u,
        vx: previous.vx + (input.vx - previous.vx) * u,
        feet: this.sampleFeet,
        gait:
          input.grounded &&
          previous.grounded &&
          !traitsOf(rig, input.action).gaitFrozen
            ? startGait + (input.gait - startGait) * u
            : input.gait,
      });
      if (
        input.skillPose &&
        previous.skillPose?.instance === input.skillPose.instance
      )
        sample.skillPose = {
          ...input.skillPose,
          age:
            previous.skillPose.age +
            (input.skillPose.age - previous.skillPose.age) * u,
        };
      if (input.support && previous.support?.id === input.support.id)
        sample.support = {
          ...input.support,
          x: previous.support.x + (input.support.x - previous.support.x) * u,
          y: previous.support.y + (input.support.y - previous.support.y) * u,
          left:
            input.support.left === undefined ||
            previous.support.left === undefined
              ? input.support.left
              : previous.support.left +
                (input.support.left - previous.support.left) * u,
          right:
            input.support.right === undefined ||
            previous.support.right === undefined
              ? input.support.right
              : previous.support.right +
                (input.support.right - previous.support.right) * u,
        };
      this.sample(sample, prior, rig);
      events.push(...this.output.events);
      for (let i = 0; i < 2; i++)
        Object.assign(this.sampleFeet[i], this.output.targets[i]);
      Object.assign(prior, sample);
    }
    this.output.events.length = 0;
    this.output.events.push(...events);
    return this.output;
  }
  private sample(
    input: SupportInput,
    previous: SupportInput | null,
    rig: SupportRig,
  ) {
    if (previous && input.clock === previous.clock) return this.output;
    this.output.events.length = 0;
    if (
      previous &&
      Math.abs(previous.vx) > 5 &&
      Math.abs(input.vx) <= 5 &&
      input.grounded
    ) {
      this.stopAt = input.clock;
      this.stopFeet = input.feet.map((p) => ({
        x: previous.x + p.x * previous.facing,
        y: previous.y + p.y,
      }));
    }
    const oldFeet = previous
      ? input.feet.map((p) => ({
          x: previous.x + p.x * previous.facing,
          y: previous.y + p.y,
        }))
      : [];
    const mobile =
      rig.support.enabled &&
      input.grounded &&
      Math.abs(input.vx) > 5 &&
      !traitsOf(rig, input.action).stepBlocked;
    const planted =
      !input.doll?.active &&
      input.grounded &&
      !traitsOf(rig, input.action).unplanted &&
      !rig.flying &&
      input.enabled;
    const dt = previous ? Math.max(0, input.clock - previous.clock) : 0;
    const span = (rig.stride * rig.stance) / 2;
    const targets = this.output.targets;
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1,
        phase = (input.gait + i * 0.5) % 1;
      const cycle = Math.floor(input.gait + i * 0.5);
      const contact = this.contacts[i];
      let localX = sign * rig.footSpan,
        localY = 0;
      let stance = !mobile || phase < rig.stance;
      const turning =
        planted && input.clock - input.turnAt < 0.075 && contact.planted;
      if (turning) stance = true;
      const stoppedSwing =
        !mobile &&
        planted &&
        previous?.grounded &&
        !contact.planted &&
        input.clock - this.stopAt < 0.08 + (input.clock - previous.clock);
      // A swing foot settles over 80ms rather than snapping to its neutral target.
      if (stoppedSwing && this.stopFeet[i]) {
        const u = clamp((input.clock - this.stopAt) / 0.08);
        localX = (this.stopFeet[i].x - input.x) * input.facing;
        localY = (this.stopFeet[i].y - input.y) * (1 - u);
        stance = u >= 1;
      }
      if (mobile) {
        if (stance) localX += span * (1 - (2 * phase) / rig.stance);
        else {
          const u = (phase - rig.stance) / (1 - rig.stance);
          localX += -span + 2 * span * (u * u * (3 - 2 * u));
          localY =
            -Math.sin(u * Math.PI) *
            rig.support.lift *
            clamp(Math.abs(input.vx) / 220, 0.5, 1);
        }
      } else if (!input.grounded || rig.flying) {
        const rise = clamp((-(input.vy ?? 0) + 100) / 350);
        localX = sign * (8 + rise * 3);
        localY = -4 - rise * (i ? 3 : 8);
        if (rig.footOffset && input.skillPose && !input.doll?.active) {
          this.skillFoot.x = this.skillFoot.y = 0;
          rig.footOffset(
            input.skillPose,
            i,
            input.combatWeight,
            this.skillFoot,
          );
          localX += this.skillFoot.x;
          localY += this.skillFoot.y;
        } else if (input.combatWeight > 0) {
          const tuck =
            Math.sin(
              clamp(input.combatAge / rig.motion.combatEnvelope) * Math.PI,
            ) * input.combatWeight;
          localX += (i ? -9 : 6) * tuck;
          localY -= (i ? 4 : 9) * tuck;
        }
      }
      if (traitsOf(rig, input.action).feetFollowRoot) {
        const r = input.root.rotation,
          px = localX,
          py = localY;
        localX = input.root.x + Math.cos(r) * px - Math.sin(r) * py;
        localY = input.root.y + Math.sin(r) * px + Math.cos(r) * py;
      }
      const surface = input.support;
      if (contact.planted && surface && contact.surfaceId === surface.id) {
        contact.x = surface.x + contact.localX;
        contact.y = surface.y + contact.localY;
      }
      const inside =
        !surface ||
        surface.left === undefined ||
        surface.right === undefined ||
        ((contact.planted && contact.surfaceId === surface.id
          ? contact.x
          : input.x + localX * input.facing) >= surface.left &&
          (contact.planted && contact.surfaceId === surface.id
            ? contact.x
            : input.x + localX * input.facing) <= surface.right);
      const reachable =
        !contact.planted || Math.abs(contact.x - input.x) < rig.leg * 1.85;
      if (!inside || !reachable) stance = false;
      if (planted && stance) {
        if (
          !contact.planted ||
          contact.surfaceId !== input.support?.id ||
          (!turning && cycle !== contact.cycle) ||
          (!turning && phase < contact.phase) ||
          (previous &&
            (!input.support || input.support.id !== previous.support?.id) &&
            Math.abs(previous.y - input.y) > 2)
        ) {
          contact.x = input.x + localX * input.facing;
          contact.y = input.y;
          contact.surfaceId = input.support?.id;
          contact.localX = contact.x - (input.support?.x ?? 0);
          contact.localY = contact.y - (input.support?.y ?? 0);
          if (mobile)
            this.output.events.push({
              x: contact.x,
              y: contact.y,
              time: input.clock,
              kind: "step",
            });
        }
        contact.planted = true;
        localX = (contact.x - input.x) * input.facing;
        localY = contact.y - input.y;
      } else {
        contact.planted = false;
        if (oldFeet[i] && previous) {
          const target = {
            x: input.x + localX * input.facing,
            y: input.y + localY,
          };
          const dx = target.x - oldFeet[i].x,
            dy = target.y - oldFeet[i].y;
          const weight = Math.min(
            1,
            (Math.max(0, input.clock - previous.clock) * 900) /
              Math.max(0.001, Math.hypot(dx, dy)),
          );
          localX = (oldFeet[i].x + dx * weight - input.x) * input.facing;
          localY = oldFeet[i].y + dy * weight - input.y;
        }
      }
      contact.phase = phase;
      contact.cycle = cycle;
      contact.stage =
        !planted || !stance
          ? "swing"
          : mobile
            ? footPhase(phase, rig.stance)
            : "stance";
      const load =
        planted && stance
          ? mobile
            ? Math.max(0.1, supportWeight(phase, rig.stance))
            : 1
          : 0;
      contact.weight = previous ? approach(contact.weight, load, dt, 28) : load;
      Object.assign(targets[i], { x: localX, y: localY, stance });
    }
    const acceleration =
      previous && dt > 0
        ? clamp((input.vx - previous.vx) / dt, -1800, 1800)
        : 0;
    const shift = planted
      ? balanceTarget(
          targets[0].x,
          targets[1].x,
          this.contacts[0].weight,
          this.contacts[1].weight,
          acceleration,
          input.facing,
          rig.support,
        )
      : 0;
    this.balanceX = approach(this.balanceX, shift, dt, rig.support.response);
    this.output.balanceX = this.balanceX;
    this.output.mobile = mobile;
    this.output.planted = planted;
    return this.output;
  }
}
