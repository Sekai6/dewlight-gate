import { TIMING } from "../actions.ts";
import { combatMotion } from "../combat-motion.ts";
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
  constructor(private state: ActorState) {}
  reset() {
    this.impulse.reset();
    this.intent.reset();
  }
  apply(pose: Pose, input: ActorInput, reacting: boolean) {
    const { rig, layers, recovery } = this.state;
    this.bodyMotion(pose, input);
    if (input.alpha !== undefined) pose.root.alpha *= input.alpha;
    if (this.impulseEnabled) {
      const impulse = this.impulse.update(input, rig.motion.impulseGain);
      const ownership = input.doll?.active ? 0 : 1;
      pose.hip.x += impulse.hip * ownership;
      pose.torso.rotation += impulse.chest * ownership;
      pose.arm.rotation += impulse.shoulder * ownership;
      pose.head.rotation += impulse.head * ownership;
      if (pose.crown) pose.crown.rotation += impulse.ornament * ownership;
    }
    if (this.intentEnabled) {
      const intent = this.intent.update(
        {
          ...input,
          target: input.intentTarget,
          suppressed:
            !!input.doll?.active ||
            input.skillPose?.phase === "release" ||
            recovery.output.hand.weight > 0,
        },
        rig.motion.attention,
      );
      pose.head.rotation += intent.head;
      pose.torso.rotation += intent.chest;
    }
    if (rig.armed && this.state.recoveryEnabled) {
      const shoulder = this.state.world.armBack;
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
      });
      pose.hip.y += crouch.crouch;
      pose.torso.rotation -= crouch.crouch * 0.018;
      pose.head.rotation += crouch.crouch * 0.012;
      pose.armBack.rotation += crouch.tuck * 0.5;
    }
    if (input.action === "hurt" && input.hitDirection !== undefined) {
      const side = -Math.sign(input.hitDirection * input.facing || -1);
      pose.torso.rotation *= side;
      pose.hip.x *= side;
    }
    const land =
      Math.sin(
        clamp((input.clock - this.state.landAt) / TIMING.land) * Math.PI,
      ) * this.state.landImpact;
    if (!reacting && layers.locomotion.enabled) {
      pose.hip.y += land * rig.motion.landDip;
      pose.torso.scaleY *= 1 - land * 0.12;
      pose.torso.scaleX *= 1 + land * 0.08;
    }
    // Body expression stays readable even with decorative motion disabled.
    for (const b of ["hip", "torso", "head"]) {
      pose[b].scaleX = clamp(pose[b].scaleX, 0.85, 1.15);
      pose[b].scaleY = clamp(pose[b].scaleY, 0.85, 1.15);
    }
  }
  private bodyMotion(pose: Pose, input: ActorInput) {
    const { rig, layers, gait, airWeight, lastCombat } = this.state;
    if (!layers.locomotion.enabled) return;
    const reaction = layers.reaction.weight;
    const combat = layers.combat;
    if (rig.armed) {
      const motion = combatMotion(lastCombat ?? "idle");
      if (motion && combat.enabled && combat.weight > 0) {
        const u = clamp(combat.age / TIMING.attack);
        const air = Math.sin(u * Math.PI) * airWeight * combat.weight;
        pose.torso.rotation -= air * motion.airborne.counter;
        pose.armBack.rotation -= air * 0.65;
        pose.foreBack.rotation -= air * 0.25;
        pose.hip.y -= air * 2;
      }
    } else if (rig.flying) {
      // Flight has no planted roots or ground gait. Wingbeat is essential motion.
      const fold =
        input.action === "windup"
          ? 1 - clamp(input.age / 0.85) * 0.85
          : input.action === "strike"
            ? 0.12
            : 1;
      const beat = Math.sin(input.clock * 13);
      const velocity = clamp((input.vx * input.facing) / 340, -1, 1);
      pose.hip.y +=
        Math.sin(input.clock * 3.5) * 1.3 * (1 - combat.weight * 0.6);
      pose.torso.rotation += velocity * 0.13 * (1 - reaction);
      pose.abdomen.rotation -= velocity * 0.18;
      pose.head.rotation -= velocity * 0.07;
      pose.wingBack.rotation += beat * 0.3 * fold;
      pose.wingFront.rotation -= Math.sin(input.clock * 13 - 0.35) * 0.3 * fold;
    } else {
      const phase = gait * Math.PI * 2;
      const moving = clamp(Math.abs(input.vx) / rig.motion.swaySpeed);
      const weight = moving * (1 - reaction);
      pose.hip.x += Math.sin(phase) * weight * rig.motion.swayAmount;
      pose.torso.rotation -= Math.sin(phase - 0.35) * weight * 0.055;
      pose.head.rotation += Math.sin(phase - 0.6) * weight * 0.025;
    }
  }
}
