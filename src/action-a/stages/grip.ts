import { aimBone, rigidify } from "../affine.ts";
import type { Action } from "../actions.ts";
import { combatMotion, sampleWeapon } from "../combat-motion.ts";
import { inertialOffset } from "../core.ts";
import type { ArmSolution } from "../ik.ts";
import type { ActorInput, ActorState } from "./state.ts";

const CHANNELS = ["x", "y", "rotation"] as const;
const vector = () => ({ x: 0, y: 0, rotation: 0 });

/** Stage 4: the weapon hand. The authored grip path is the target; the arm is
 *  solved to it with rigid segments, and a change of attack is absorbed by an
 *  inertial offset instead of a pop. */
export class WeaponGrip {
  /** Where the grip is this frame, in actor-local space. */
  readonly target = vector();
  readonly arm: ArmSolution = {
    jointX: 0,
    jointY: 0,
    x: 0,
    y: 0,
    direction: 0,
  };
  /** False until one solve has happened; the next solve then starts fresh. */
  ready = false;
  private velocity = vector();
  private correction = vector();
  private momentum = vector();
  private correctedAt = -999;
  private instance: string | number | undefined;
  private action: Action = "idle";
  private active = false;
  constructor(private state: ActorState) {}
  reset() {
    this.arm.direction = 0;
    this.ready = this.active = false;
    this.action = "idle";
    this.instance = undefined;
    this.correctedAt = -999;
    for (const c of CHANNELS) this.correction[c] = this.momentum[c] = 0;
  }
  solve(input: ActorInput, dt: number) {
    const { rig, world, layers, lastCombat, combatInstance } = this.state;
    const combat = layers.combat;
    const motion = combatMotion(lastCombat ?? "idle");
    const shoulder = world.arm,
      elbow = world.fore,
      wrist = world.weapon;
    const target = this.target;
    const oldX = target.x,
      oldY = target.y,
      oldR = target.rotation;
    const active = motion && combat.enabled && combat.weight > 0;
    let retarget: boolean;
    if (active) {
      sampleWeapon(motion, combat.age, target, this.state.airWeight);
      target.x += shoulder.x;
      target.y += shoulder.y;
      // Fade the constrained sword with its combat layer, including recovery.
      const weight = combat.weight;
      target.x = wrist.x + (target.x - wrist.x) * weight;
      target.y = wrist.y + (target.y - wrist.y) * weight;
      target.rotation =
        wrist.rotation +
        Math.atan2(
          Math.sin(target.rotation - wrist.rotation),
          Math.cos(target.rotation - wrist.rotation),
        ) *
          weight;
      retarget =
        this.ready &&
        (this.instance !== combatInstance || this.action !== lastCombat);
    } else {
      target.x = wrist.x;
      target.y = wrist.y;
      target.rotation = wrist.rotation;
      retarget = this.active && this.ready;
    }
    if (retarget) {
      this.correction.x = oldX - target.x;
      this.correction.y = oldY - target.y;
      this.correction.rotation = oldR - target.rotation;
      for (const c of CHANNELS) this.momentum[c] = this.velocity[c];
      this.correctedAt = input.clock;
    }
    for (const c of CHANNELS)
      target[c] += inertialOffset(
        this.correction[c],
        this.momentum[c],
        input.clock - this.correctedAt,
        0.045,
      );
    const lengths = rig.arms.front;
    const solved = this.state.contact.solve(
      {
        id: "grip",
        kind: "grip",
        anchorX: shoulder.x,
        anchorY: shoulder.y,
        x: target.x,
        y: target.y,
        upper: lengths.upper,
        lower: lengths.lower,
        bend: -1,
        weight: 1,
        valid: true,
        arm: this.arm,
        ready: this.ready,
      },
      dt,
    );
    aimBone(shoulder, shoulder.x, shoulder.y, solved.jointX, solved.jointY);
    aimBone(elbow, solved.jointX, solved.jointY, solved.x, solved.y);
    wrist.x = solved.x;
    wrist.y = solved.y;
    wrist.rotation = target.rotation;
    rigidify(wrist);
    this.state.hand.x = solved.x;
    this.state.hand.y = solved.y;
    Object.assign(world.shoulderFront, shoulder);
    Object.assign(world.elbowFront, elbow);
    this.state.armError = Math.hypot(
      wrist.x - (elbow.x + elbow.c * lengths.lower),
      wrist.y - (elbow.y + elbow.d * lengths.lower),
    );
    if (dt > 0 && this.ready) {
      this.velocity.x = (wrist.x - oldX) / dt;
      this.velocity.y = (wrist.y - oldY) / dt;
      this.velocity.rotation = (wrist.rotation - oldR) / dt;
    }
    target.x = wrist.x;
    target.y = wrist.y;
    this.instance = combatInstance;
    this.action = lastCombat ?? input.action;
    this.active = !!active;
    this.ready = true;
  }
}
