import type { Pose } from "@dewlight/action-a";
import { clamp } from "@dewlight/action-a";
import type { ActorInput, ActorState } from "@dewlight/action-a";
import { TIMING } from "./actions.ts";
import { combatMotion } from "./combat-motion.ts";

/** The hero leans against a swing made in the air. */
export function swordBody(pose: Pose, _input: ActorInput, state: ActorState) {
  const { layers, airWeight, lastCombat } = state;
  const combat = layers.combat;
  const motion = combatMotion(lastCombat ?? "idle");
  if (motion && combat.enabled && combat.weight > 0) {
    const u = clamp(combat.age / TIMING.attack);
    const air = Math.sin(u * Math.PI) * airWeight * combat.weight;
    pose.torso.rotation -= air * motion.airborne.counter;
    pose.armBack.rotation -= air * 0.65;
    pose.foreBack.rotation -= air * 0.25;
    pose.hip.y -= air * 2;
  }
}

/** Flight has no planted roots or ground gait. Wingbeat is essential motion. */
export function wingBody(pose: Pose, input: ActorInput, state: ActorState) {
  const combat = state.layers.combat,
    reaction = state.layers.reaction.weight;
  const fold =
    input.action === "windup"
      ? 1 - clamp(input.age / 0.85) * 0.85
      : input.action === "strike"
        ? 0.12
        : 1;
  const beat = Math.sin(input.clock * 13);
  const velocity = clamp((input.vx * input.facing) / 340, -1, 1);
  pose.hip.y += Math.sin(input.clock * 3.5) * 1.3 * (1 - combat.weight * 0.6);
  pose.torso.rotation += velocity * 0.13 * (1 - reaction);
  pose.abdomen.rotation -= velocity * 0.18;
  pose.head.rotation -= velocity * 0.07;
  pose.wingBack.rotation += beat * 0.3 * fold;
  pose.wingFront.rotation -= Math.sin(input.clock * 13 - 0.35) * 0.3 * fold;
}

/** Heavy walkers roll their hips with the gait. */
export function walkerBody(pose: Pose, input: ActorInput, state: ActorState) {
  const { rig, gait } = state;
  const reaction = state.layers.reaction.weight;
  const phase = gait * Math.PI * 2;
  const moving = clamp(Math.abs(input.vx) / rig.motion.swaySpeed);
  const weight = moving * (1 - reaction);
  pose.hip.x += Math.sin(phase) * weight * rig.motion.swayAmount;
  pose.torso.rotation -= Math.sin(phase - 0.35) * weight * 0.055;
  pose.head.rotation += Math.sin(phase - 0.6) * weight * 0.025;
}
