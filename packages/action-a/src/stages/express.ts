import { phaseOf, traitsOf } from "../definition.ts";

import { clamp, type Pose } from "../core.ts";
import { ImpulseController } from "../impulse/controller.ts";
import { IntentController } from "../intent/controller.ts";
import type { ActorInput, ActorState } from "./state.ts";

/** Stage 2: additive body expression on the composed local pose: airborne
 *  counter-rotation, wingbeat or walker sway, force impulses, attention,
 *  post-hit crouch, hit mirroring and landing squash. */
export class BodyExpression {
  readonly impulse = new ImpulseController();
  readonly intent = new IntentController();
  impulseEnabled = true;
  intentEnabled = true;
  private state: ActorState;
  constructor(state: ActorState) {
    this.state = state;
  }
  reset() {
    this.impulse.reset();
    this.intent.reset();
  }
  apply(pose: Pose, input: ActorInput, reacting: boolean) {
    const { rig, layers, recovery } = this.state;
    const slots = rig.slots;
    const traits = traitsOf(rig, input.action);
    if (layers.locomotion.enabled) rig.bodyMotion?.(pose, input, this.state);
    if (input.alpha !== undefined) pose[slots.root].alpha *= input.alpha;
    if (this.impulseEnabled) {
      const impulse = this.impulse.update(
        input,
        rig.motion.impulseGain,
        traits.impulse === "hit"
          ? -Math.sign((input.hitDirection ?? 1) * input.facing)
          : traits.impulse,
      );
      const ownership = input.doll?.active ? 0 : 1;
      pose[slots.hip].x += impulse.hip * ownership;
      pose[slots.chest].rotation += impulse.chest * ownership;
      pose[slots.front.upper].rotation += impulse.shoulder * ownership;
      pose[slots.head].rotation += impulse.head * ownership;
      const ornament = slots.ornament ? pose[slots.ornament] : undefined;
      if (ornament) ornament.rotation += impulse.ornament * ownership;
    }
    if (this.intentEnabled) {
      const intent = this.intent.update(
        {
          ...input,
          target: input.intentTarget,
          suppressed:
            !!input.doll?.active ||
            input.skillPose?.phase === "release" ||
            (!!traits.phases &&
              phaseOf(traits.phases, input.age) === "release") ||
            traits.layer === "reaction" ||
            recovery.output.hand.weight > 0,
        },
        rig.motion.attention,
      );
      pose[slots.head].rotation += intent.head;
      pose[slots.chest].rotation += intent.chest;
    }
    if (rig.armed && this.state.recoveryEnabled) {
      const shoulder = this.state.world[slots.back.upper];
      const back = rig.arms.back;
      const crouch = recovery.update({
        ...input,
        shoulder: shoulder
          ? {
              x: input.x + shoulder.x * input.facing,
              y: input.y + shoulder.y,
            }
          : undefined,
        reach: back.upper + back.lower - 0.5,
        cancel: traits.recoveryCancel,
      });
      pose[slots.hip].y += crouch.crouch;
      pose[slots.chest].rotation -= crouch.crouch * 0.018;
      pose[slots.head].rotation += crouch.crouch * 0.012;
      pose[slots.back.upper].rotation += crouch.tuck * 0.5;
    }
    if (traits.mirrorsHit && input.hitDirection !== undefined) {
      const side = -Math.sign(input.hitDirection * input.facing || -1);
      pose[slots.chest].rotation *= side;
      pose[slots.hip].x *= side;
    }
    const land =
      Math.sin(
        clamp((input.clock - this.state.landAt) / rig.motion.landSquash) *
          Math.PI,
      ) * this.state.landImpact;
    if (!reacting && layers.locomotion.enabled) {
      pose[slots.hip].y += land * rig.motion.landDip;
      pose[slots.chest].scaleY *= 1 - land * 0.12;
      pose[slots.chest].scaleX *= 1 + land * 0.08;
    }
    // Body expression stays readable even with decorative motion disabled.
    for (const b of [slots.hip, slots.chest, slots.head]) {
      pose[b].scaleX = clamp(pose[b].scaleX, 0.85, 1.15);
      pose[b].scaleY = clamp(pose[b].scaleY, 0.85, 1.15);
    }
  }
}
