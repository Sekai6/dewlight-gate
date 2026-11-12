import { rotateBasis } from "../affine.ts";
import { FollowSpring, clamp, type Pose } from "../core.ts";
import type { ActorInput, ActorState } from "./state.ts";

/** Stage 7: secondary motion. Cape, crown and lamp trail the body on springs. */
export class FollowStage {
  private cape = new FollowSpring();
  private ornament = new FollowSpring();
  private state: ActorState;
  constructor(state: ActorState) {
    this.state = state;
  }
  reset() {
    this.cape.reset();
    this.ornament.reset();
  }
  apply(pose: Pose, input: ActorInput, dt: number) {
    const { rig, world } = this.state;
    const slots = rig.slots;
    const weight = this.state.followEnabled && !input.reduced ? 1 : 0;
    const cape = this.cape.update(
      clamp((input.vx * input.facing) / 300, -1.4, 1.4) * 0.8 -
        pose[slots.chest].rotation * 0.85,
      dt,
      rig.motion.capeRate,
    );
    const crown = this.ornament.update(
      -pose[slots.chest].rotation * 0.9 + Math.sin(input.clock * 3) * 0.05,
      dt,
      rig.motion.ornamentRate,
    );
    const bone = (name: string | undefined) => (name ? world[name] : undefined);
    const sway = bone(slots.sway),
      ornament = bone(slots.ornament),
      dangle = bone(slots.dangle);
    if (sway) rotateBasis(sway, cape * weight);
    if (ornament) rotateBasis(ornament, crown * weight);
    if (dangle) rotateBasis(dangle, -cape * 0.7 * weight);
  }
}
