import { aimBone } from "../affine.ts";
import type { ActorInput, ActorState } from "./state.ts";

/** Stage 6: while getting up, the free hand braces on the ground point chosen
 *  by the recovery controller. Both arm segments stay rigid. */
export function braceHand(state: ActorState, input: ActorInput) {
  const { rig, world } = state;
  const slots = rig.slots;
  const target = state.recovery.output.hand;
  if (
    !state.recoveryEnabled ||
    !state.contactEnabled ||
    !rig.armed ||
    target.weight <= 0
  )
    return;
  const arm = world[slots.back.upper],
    fore = world[slots.back.lower],
    hand = world[slots.back.end];
  const lengths = rig.arms.back;
  const x = (target.x - input.x) * input.facing,
    y = target.y - input.y;
  if (Math.hypot(x - arm.x, y - arm.y) > lengths.upper + lengths.lower - 0.5)
    return;
  const solved = state.contact.solve(
    {
      id: "free-hand",
      kind: "brace",
      anchorX: arm.x,
      anchorY: arm.y,
      x: hand.x + (x - hand.x) * target.weight,
      y: hand.y + (y - hand.y) * target.weight,
      upper: lengths.upper,
      lower: lengths.lower,
      bend: -1,
      weight: target.weight,
      valid: state.contactEnabled && input.grounded,
    },
    // Release fading is left to ContactController.endFrame.
    0,
  );
  aimBone(arm, arm.x, arm.y, solved.jointX, solved.jointY);
  aimBone(fore, solved.jointX, solved.jointY, solved.x, solved.y);
  Object.assign(world[slots.back.shoulder], arm);
  Object.assign(world[slots.back.elbow], fore);
  hand.x = solved.x;
  hand.y = solved.y;
}
