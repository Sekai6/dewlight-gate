import { aimBone, rigidify, rotateAbout } from "../affine.ts";
import { approach } from "../balance.ts";
import { clamp, type WorldPose } from "../core.ts";
import { DollPoseSolver } from "../doll-hit/solver.ts";
import type { LimbSolution } from "../ik.ts";
import type { WeaponGrip } from "./grip.ts";
import type { ActorInput, ActorState } from "./state.ts";

const LEG_PARTS = ["thigh", "shin", "knee", "ankle", "foot"];
const BLEND = ["x", "y", "a", "b", "c", "d", "rotation"] as const;

/** Stage 5: the hit ragdoll. The whole body tumbles about the hip while four
 *  inertial end points (hands and feet) trail on rigid two-bone limbs. */
export class DollStage {
  readonly solver = new DollPoseSolver();
  private instance = "";
  private entry: WorldPose = {};
  private limb: LimbSolution = { jointX: 0, jointY: 0, x: 0, y: 0 };
  private lastAngle = 0;
  private head = 0;
  constructor(
    private state: ActorState,
    private grip: WeaponGrip,
  ) {}
  reset() {
    this.solver.reset();
    this.instance = "";
    this.entry = {};
    this.lastAngle = this.head = 0;
  }
  /** Call once per frame before the pose is rebuilt. Returns true when a
   *  ragdoll began or ended, which invalidates the weapon trail. */
  transition(input: ActorInput, previous: ActorInput | null) {
    const { rig, world, feet, contacts } = this.state;
    if (input.doll?.active && input.doll.instance !== this.instance) {
      this.instance = input.doll.instance;
      this.lastAngle = this.head = 0;
      this.solver.reset();
      // Remember the pose at impact and seed the end points with its momentum.
      for (const [key, value] of Object.entries(world))
        this.entry[key] = { ...value };
      if (world.weapon) {
        const drift = -input.vx * input.facing;
        this.solver.seed(0, world.weapon.x, world.weapon.y, drift * 0.18, 30);
        // Legacy: the free hand is seeded at the front forearm's length.
        const back = world.foreBack,
          length = rig.arms.front.lower;
        this.solver.seed(
          1,
          back.x + back.c * length,
          back.y + back.d * length,
          drift * 0.13,
          20,
        );
        for (let i = 0; i < 2; i++)
          this.solver.seed(i + 2, feet[i].x, feet[i].y, drift * 0.1, 15);
        this.solver.ready = true;
      }
      return true;
    }
    if (!input.doll?.active && previous?.doll?.active) {
      this.solver.reset();
      this.grip.ready = false;
      // Re-plant the feet where the body came to rest.
      for (let i = 0; i < 2; i++) {
        const c = contacts[i],
          f = feet[i];
        if (input.grounded && f) {
          c.x = previous.x + f.x * previous.facing;
          c.y = input.y;
          const surface = input.support;
          c.planted =
            !surface ||
            surface.left === undefined ||
            surface.right === undefined ||
            (c.x >= surface.left && c.x <= surface.right);
          c.surfaceId = surface?.id;
          c.localX = c.x - (surface?.x ?? 0);
          c.localY = c.y - (surface?.y ?? 0);
        } else c.planted = false;
      }
      return true;
    }
    return false;
  }
  apply(input: ActorInput, dt: number) {
    const state = this.state,
      { rig, world, parts, feet, knees, hips, contact } = state;
    const doll = input.doll!;
    const solver = this.solver;
    const weight = doll.weight;
    const angle =
      (input.reduced ? Math.sin(doll.angle) * 0.5 : doll.angle) * input.facing;
    solver.output.rotation = angle;
    solver.output.weight = weight;
    solver.output.error = 0;
    // Ease out of the pose held at impact, then tumble the body about the hip.
    const entryWeight = Math.max(0, 1 - doll.age / 0.1);
    for (const [name, t] of Object.entries(world)) {
      const entry = this.entry[name];
      if (entry && entryWeight > 0)
        for (const key of BLEND) t[key] += (entry[key] - t[key]) * entryWeight;
    }
    const cx = world.hip.x,
      cy = world.hip.y;
    const c = Math.cos(angle),
      s = Math.sin(angle);
    rotateAbout(Object.values(world), cx, cy, angle);
    // The head lags the spin.
    const headTarget =
      dt > 0
        ? clamp((-(angle - this.lastAngle) / dt) * 0.018, -0.22, 0.22) * weight
        : 0;
    this.head = approach(this.head, headTarget, dt, 16);
    rotateAbout(
      [world.head, world.crown],
      world.head.x,
      world.head.y,
      this.head,
    );
    const floor = input.dollFloor ?? Infinity;
    for (let i = 0; i < 2; i++) {
      const arm = world[i ? "armBack" : "arm"],
        fore = world[i ? "foreBack" : "fore"],
        end = world[i ? "lamp" : "weapon"];
      const lengths = i ? rig.arms.back : rig.arms.front;
      const tx = i ? fore.x + fore.c * lengths.lower : end.x;
      const ty = i ? fore.y + fore.d * lengths.lower : end.y;
      if (!solver.ready) solver.seed(i, tx, ty, 0, 0);
      const limb = solver.solve(
        i,
        arm.x,
        arm.y,
        tx,
        ty,
        lengths.upper,
        lengths.lower,
        -1,
        dt,
        weight,
        floor - 4,
        this.limb,
        contact,
      );
      aimBone(arm, arm.x, arm.y, limb.jointX, limb.jointY);
      aimBone(fore, limb.jointX, limb.jointY, limb.x, limb.y);
      Object.assign(world[i ? "shoulderBack" : "shoulderFront"], arm);
      Object.assign(world[i ? "elbowBack" : "elbowFront"], fore);
      end.x = limb.x;
      end.y = limb.y;
      if (!i) {
        state.hand.x = this.grip.target.x = limb.x;
        state.hand.y = this.grip.target.y = limb.y;
        rigidify(end);
      }
    }
    const segment = (
      name: string,
      x: number,
      y: number,
      tx: number,
      ty: number,
    ) =>
      parts
        .get(name)!
        .setPosition((x + tx) / 2, (y + ty) / 2)
        .setRotation(Math.atan2(ty - y, tx - x) - Math.PI / 2)
        .setDisplaySize(rig.legSkin.width, rig.leg * 1.3);
    for (let i = 0; i < 2; i++) {
      const offset = (i ? 1 : -1) * rig.footSpan * 0.6;
      const hx = cx + c * offset,
        hy = cy + s * offset;
      const fx = feet[i].x - cx,
        fy = feet[i].y - cy;
      const tx = cx + c * fx - s * fy,
        ty = cy + s * fx + c * fy;
      if (!solver.ready) solver.seed(i + 2, tx, ty, 0, 0);
      const limb = solver.solve(
        i + 2,
        hx,
        hy,
        tx,
        ty,
        rig.leg,
        rig.leg,
        rig.knees[i],
        dt,
        weight,
        floor - 2,
        this.limb,
        contact,
      );
      hips[i].x = hx;
      hips[i].y = hy;
      knees[i].x = limb.jointX;
      knees[i].y = limb.jointY;
      feet[i].x = limb.x;
      feet[i].y = limb.y;
      segment(`thigh${i}`, hx, hy, limb.jointX, limb.jointY);
      segment(`shin${i}`, limb.jointX, limb.jointY, limb.x, limb.y);
      parts.get(`knee${i}`)!.setPosition(limb.jointX, limb.jointY);
      parts.get(`ankle${i}`)!.setPosition(limb.x, limb.y - 2);
      parts
        .get(`foot${i}`)!
        .setPosition(limb.x, limb.y)
        .setRotation(angle * weight);
    }
    // Keep the complete silhouette above its support surface; translate the
    // whole constrained body, never individual bones after solving lengths.
    let bottom = -Infinity;
    for (const skin of rig.skin) {
      const t = world[skin.bone],
        origin = skin.originY ?? 0.5;
      for (const x of [-skin.width / 2, skin.width / 2])
        for (const y of [-origin * skin.height, (1 - origin) * skin.height])
          bottom = Math.max(bottom, t.y + t.b * x + t.d * y);
    }
    const legParts = [0, 1].flatMap((i) =>
      LEG_PARTS.map((name) => parts.get(`${name}${i}`)!),
    );
    for (const p of legParts)
      for (const x of [
        -p.originX * p.displayWidth,
        (1 - p.originX) * p.displayWidth,
      ])
        for (const y of [
          -p.originY * p.displayHeight,
          (1 - p.originY) * p.displayHeight,
        ])
          bottom = Math.max(
            bottom,
            p.y + Math.sin(p.rotation) * x + Math.cos(p.rotation) * y,
          );
    const lift = Math.max(0, bottom - floor - 2);
    if (lift > 0) {
      for (const t of Object.values(world)) t.y -= lift;
      for (const list of [feet, knees, hips]) for (const p of list) p.y -= lift;
      for (const p of legParts) p.setPosition(p.x, p.y - lift);
      state.hand.y -= lift;
      this.grip.target.y -= lift;
    }
    state.armError = solver.output.error;
    solver.ready = true;
    this.lastAngle = angle;
  }
}
