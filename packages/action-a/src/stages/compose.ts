import { traitsOf } from "../definition.ts";

import {
  FollowSpring,
  PoseBuffer,
  clamp,
  type Channel,
  type Pose,
} from "../core.ts";

import type { ActorInput, ActorState } from "./state.ts";

/** Stage 1: evaluate the locomotion, combat and reaction layers into one
 *  local pose. Combat finishes its recovery independently of the gait. */
export class PoseComposer {
  /** Per-bone combat weights of the last frame, kept for diagnostics. */
  readonly weightedMask: Record<
    string,
    number | Partial<Record<Channel, number>>
  > = {};
  /** Clip events fired this frame. */
  events: string[] = [];
  /** A reaction (hurt, defeat, bound) owns the body this frame. */
  reacting = false;
  private readonly composed: PoseBuffer;
  private movement = new FollowSpring();
  private state: ActorState;
  constructor(state: ActorState) {
    this.state = state;
    this.composed = new PoseBuffer(state.rig.bones);
  }
  reset() {
    this.movement.reset();
  }
  compose(input: ActorInput, previous: ActorInput | null, dt: number): Pose {
    const rig = this.state.rig,
      layers = this.state.layers;
    const reacting = (this.reacting =
      traitsOf(rig, input.action).layer === "reaction");
    const fighting =
      !reacting && traitsOf(rig, input.action).layer === "combat";
    const pose = this.locomotion(input, previous, dt);
    const events = this.events;
    const combat = layers.combat;
    const reaction = layers.reaction;
    if (fighting) {
      const result = combat.evaluate(
        rig.clip(input.action),
        input.age,
        input.clock,
        input.instance,
      );
      events.push(...result.events);
      combat.weight = Math.min(1, combat.weight + (previous ? dt / 0.025 : 1));
    } else if (combat.weight > 0 && !reacting) {
      // The inactive combat player finishes recovery independently of the base gait.
      const action =
        previous && traitsOf(rig, previous.action).layer === "combat"
          ? previous.action
          : this.state.lastCombat;
      if (action)
        combat.evaluate(
          rig.clip(action),
          combat.age + dt,
          input.clock,
          this.state.combatInstance,
        );
      combat.weight = Math.max(0, combat.weight - dt / 0.1);
    }
    if (fighting) {
      this.state.lastCombat = input.action;
      this.state.combatInstance = input.instance;
    }
    if (reacting) {
      combat.weight = 0;
      const result = reaction.evaluate(
        rig.clip(input.action),
        input.age,
        input.clock,
        input.instance,
      );
      events.push(...result.events);
      reaction.weight = Math.min(
        1,
        reaction.weight + (previous ? dt / 0.015 : 1),
      );
      this.state.lastReaction = input.action;
    } else if (reaction.weight > 0) {
      reaction.evaluate(
        rig.clip(this.state.lastReaction),
        reaction.age + dt,
        input.clock,
      );
      reaction.weight = Math.max(0, reaction.weight - dt / 0.12);
    }
    const lastCombat = this.state.lastCombat;
    const maskedCombat =
      !!rig.combat &&
      input.grounded &&
      Math.abs(input.vx) > 5 &&
      traitsOf(rig, lastCombat ?? "").upperBody === true;
    combat.apply(
      pose,
      combat.weight,
      rig.combat?.motion(lastCombat ?? "idle")
        ? rig.combat.mask(
            combat.age,
            maskedCombat,
            this.weightedMask,
            lastCombat,
          )
        : maskedCombat
          ? rig.slots.upperBody
          : undefined,
    );
    reaction.apply(
      pose,
      reaction.weight,
      undefined,
      traitsOf(rig, this.state.lastReaction).blend ?? "override",
    );
    return pose;
  }
  /** Base clip plus the procedural gait: bob, sway, lean and arm swing. */
  private locomotion(
    input: ActorInput,
    previous: ActorInput | null,
    dt: number,
  ) {
    const { rig, layers, gait } = this.state;
    const slots = rig.slots;
    const baseAction = rig.flying
      ? "idle"
      : traitsOf(rig, input.action).transition
        ? input.action
        : !input.grounded
          ? (input.vy ?? 0) < -80
            ? "rise"
            : (input.vy ?? 0) > 80
              ? "fall"
              : "apex"
          : Math.abs(input.vx) > 5
            ? Math.abs(input.vx) > 180
              ? "run"
              : "walk"
            : "idle";
    const baseAge =
      baseAction === "walk" || baseAction === "run"
        ? gait
        : baseAction === input.action
          ? input.age
          : input.clock;
    const base = layers.locomotion.evaluate(
      rig.clip(baseAction),
      baseAge,
      input.clock,
    );
    layers.locomotion.weight = 1;
    this.events = [...base.events];
    const pose = this.composed.copy(base.pose);
    if (!layers.locomotion.enabled) this.composed.rest();
    const speedTarget = input.grounded
      ? clamp(Math.abs(input.vx) / rig.motion.runSpeed)
      : 0;
    if (!previous) this.movement.reset(speedTarget);
    const amount = this.movement.update(speedTarget, dt, 20);
    const moving = input.grounded && Math.abs(input.vx) > 5;
    const cycle = gait * Math.PI * 2;
    if (
      !rig.flying &&
      layers.locomotion.enabled &&
      (baseAction === "walk" || baseAction === "run" || baseAction === "idle")
    ) {
      pose[slots.hip].y -= moving
        ? Math.abs(Math.sin(cycle)) * rig.bob
        : Math.sin(input.clock * 2.5) * 0.65;
      pose[slots.hip].x += Math.sin(cycle) * amount * rig.sway;
      pose[slots.chest].rotation +=
        amount * rig.lean + Math.sin(cycle) * amount * 0.065;
      pose[slots.head].rotation -= amount * 0.12;
      pose[slots.front.upper].rotation += Math.sin(cycle) * amount * 0.85;
      pose[slots.back.upper].rotation -= Math.sin(cycle) * amount * 0.85;
      pose[slots.front.lower].rotation -= amount * 0.3;
      const pushing = input.clock - this.state.startAt;
      if (pushing < rig.motion.startPush) {
        const push = Math.sin((pushing / rig.motion.startPush) * Math.PI);
        pose[slots.chest].rotation += push * 0.2;
        pose[slots.hip].y += push * 3;
      }
    }
    return pose;
  }
}
