import { rotateAbout } from "../affine.ts";
import { combatMotion } from "../combat-motion.ts";
import { clamp } from "../core.ts";
import type { SupportInput } from "../support/controller.ts";
import type { ActorInput, ActorState } from "./state.ts";

/** Stage 3: plant the feet. The support controller picks the foot targets and
 *  the balance shift; the body follows, then each leg is solved to its target
 *  and the leg sprites are placed. */
export function solveLegs(
  state: ActorState,
  input: ActorInput,
  previous: ActorInput | null,
) {
  const { rig, world, parts, contacts, layers } = state;
  const makeInput = (value: ActorInput): SupportInput => ({
    ...value,
    root: world.root,
    enabled: state.supportEnabled && state.contactEnabled,
    gait: state.gait,
    turnAt: state.turnAt,
    feet: state.feet,
    combatWeight: combatMotion(state.lastCombat ?? "idle")
      ? layers.combat.weight
      : 0,
    combatAge: layers.combat.age,
  });
  const result = state.support.update(
    makeInput(input),
    previous ? makeInput(previous) : null,
    rig,
  );
  const { targets, mobile } = result;
  const balanceX = result.balanceX;
  state.motes.push(...result.events);
  state.feet = [];
  state.knees = [];
  state.hips = [];
  state.support.constrainBody(world.hip.x, world.hip.y, rig);
  rotateAbout(
    state.chestBones.map((name) => world[name]),
    world.torso.x,
    world.torso.y,
    result.chestLean,
  );
  const pelvis = result.pelvisY;
  // Translate the complete hip subtree together, never an isolated IK origin.
  for (const [name, t] of Object.entries(world))
    if (name !== "root") {
      t.x += balanceX;
      t.y += pelvis;
    }
  state.pelvisOffset.x = balanceX;
  state.pelvisOffset.y = pelvis;
  const alpha = world.root.alpha;
  const segment = (
    key: string,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ) =>
    parts
      .get(key)!
      .setPosition((ax + bx) / 2, (ay + by) / 2)
      .setRotation(Math.atan2(by - ay, bx - ax) - Math.PI / 2)
      .setDisplaySize(rig.legSkin.width, Math.hypot(bx - ax, by - ay) * 1.3)
      .setAlpha(alpha);
  for (let i = 0; i < 2; i++) {
    const { x: targetX, y: targetY, stance } = targets[i];
    const hx = world.hip.x + (i ? 1 : -1) * rig.footSpan * 0.6,
      hy = world.hip.y;
    // The ragdoll solves its own legs; hand it the raw targets.
    const solved = input.doll?.active
      ? { jointX: hx, jointY: hy, x: targetX, y: targetY }
      : state.contact.solve(
          {
            id: `foot${i}`,
            kind: "foot",
            anchorX: hx,
            anchorY: hy,
            x: targetX,
            y: targetY,
            upper: rig.leg,
            lower: rig.leg,
            bend: rig.knees[i],
            weight: contacts[i].weight,
            valid: state.contactEnabled && stance && !rig.flying,
            surfaceId: input.support?.id,
            surfaceX: ((input.support?.x ?? input.x) - input.x) * input.facing,
            surfaceY: (input.support?.y ?? input.y) - input.y,
          },
          previous ? input.clock - previous.clock : 0,
        );
    const kx = solved.jointX,
      ky = solved.jointY,
      fx = solved.x,
      fy = solved.y;
    state.hips.push({ x: hx, y: hy });
    state.knees.push({ x: kx, y: ky });
    state.feet.push({ x: fx, y: fy });
    segment(`thigh${i}`, hx, hy, kx, ky);
    segment(`shin${i}`, kx, ky, fx, fy);
    parts.get(`knee${i}`)!.setPosition(kx, ky).setAlpha(alpha);
    parts
      .get(`ankle${i}`)!
      .setPosition(fx, fy - 2)
      .setAlpha(alpha);
    parts
      .get(`foot${i}`)!
      .setPosition(fx, fy)
      .setRotation(
        stance
          ? mobile
            ? clamp((contacts[i].phase / rig.stance - 0.7) / 0.3) * 0.2
            : 0
          : -0.35,
      )
      .setAlpha(alpha);
  }
}
