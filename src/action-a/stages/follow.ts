import { rotateBasis } from "../affine.ts";
import { FollowSpring, clamp, type Pose } from "../core.ts";
import type { ActorInput, ActorState } from "./state.ts";

/** Stage 7: secondary motion. Cape, crown and lamp trail the body on springs. */
export class FollowStage {
  private cape = new FollowSpring();
  private ornament = new FollowSpring();
  constructor(private state: ActorState) {}
  reset() {
    this.cape.reset();
    this.ornament.reset();
  }
  apply(pose: Pose, input: ActorInput, dt: number) {
    const { rig, world } = this.state;
    const weight = this.state.followEnabled && !input.reduced ? 1 : 0;
    const cape = this.cape.update(
      clamp((input.vx * input.facing) / 300, -1.4, 1.4) * 0.8 -
        pose.torso.rotation * 0.85,
      dt,
      rig.motion.capeRate,
    );
    const crown = this.ornament.update(
      -pose.torso.rotation * 0.9 + Math.sin(input.clock * 3) * 0.05,
      dt,
      rig.motion.ornamentRate,
    );
    if (world.cape) rotateBasis(world.cape, cape * weight);
    if (world.crown) rotateBasis(world.crown, crown * weight);
    if (world.lamp) rotateBasis(world.lamp, -cape * 0.7 * weight);
  }
}
