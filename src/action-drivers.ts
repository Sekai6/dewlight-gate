import { GUARDIAN } from "./boss";
import type { HeroPose } from "./art";
import type { Enemy } from "./creature";
import type { DewGuardian } from "./boss";
import type { ActorInput } from "./action-a/actor";
import {
  ATTACKS,
  TIMING,
  attackPhase,
  type Action,
} from "./action-a/actions.ts";

export function heroAction(p: HeroPose, reduced = false): ActorInput {
  let action: Action = "idle",
    age = p.clock;
  const since = (at = -999) => p.clock - at;
  const choose = (name: Action, at: number) => {
    action = name;
    age = since(at);
  };
  if (p.dollPose?.active) choose("hurt", p.hurtAt);
  else if (since(p.hurtAt) >= 0 && since(p.hurtAt) < TIMING.hurtHero)
    choose("hurt", p.hurtAt);
  else if (p.skillPose) {
    action = `skill-${p.skillPose.id}`;
    age = p.skillPose.age;
  } else if (since(p.dashAt) >= 0 && since(p.dashAt) < TIMING.dash)
    choose("dash", p.dashAt);
  else if (since(p.attackAt) >= 0 && since(p.attackAt) < TIMING.attack) {
    // attackStyle is stable for this attack; landing must not restart its clip.
    choose(p.attackStyle ? "rising-slash" : "slash", p.attackAt);
  } else if (since(p.bindAt) >= 0 && since(p.bindAt) < TIMING.bind)
    choose("bind", p.bindAt);
  else if (!p.onGround && since(p.launchAt) < TIMING.launch)
    choose("launch", p.launchAt!);
  else if (!p.onGround)
    action = p.vy < -80 ? "rise" : p.vy > 80 ? "fall" : "apex";
  else if (since(p.landAt) < TIMING.land && Math.abs(p.vx) < 80)
    choose("land", p.landAt!);
  else if (since(p.turnAt) < TIMING.turn) choose("turn", p.turnAt!);
  else if (since(p.brakeAt) < TIMING.brake) choose("brake", p.brakeAt!);
  else if (Math.abs(p.vx) > 5) action = Math.abs(p.vx) > 180 ? "run" : "walk";
  return {
    skillPose: p.skillPose,
    intentTarget: p.intentTarget,
    x: p.x,
    doll: p.dollPose ?? undefined,
    dollFloor: p.dollFloor,
    attackSegment: p.attackStyle ? 2 : 1,
    y: p.y,
    instance: p.skillPose
      ? `skill:${p.skillPose.instance}`
      : ATTACKS.has(action)
        ? `attack:${p.attackAt}`
        : undefined,
    support: p.support,
    landingSpeed: p.landingSpeed,
    clock: p.clock,
    facing: p.facing,
    action,
    age,
    vx: p.vx,
    vy: p.vy,
    grounded: p.onGround,
    reduced,
    moving: p.onGround && Math.abs(p.vx) > 5,
    hitDirection: p.hitDirection,
    combatPhase: attackPhase(age),
  };
}
export function creatureAction(
  e: Enemy,
  clock: number,
  reduced = false,
  target?: import("./action-a/intent/controller").IntentTarget,
): ActorInput {
  const action: Action =
    e.hp <= 0
      ? "defeat"
      : e.bound > clock
        ? "bound"
        : clock - e.hurtAt < TIMING.hurt
          ? "hurt"
          : e.phase === "patrol"
            ? "walk"
            : e.phase;
  const at =
    action === "defeat" ? e.diedAt : action === "hurt" ? e.hurtAt : e.phaseAt;
  return {
    intentTarget: e.phase !== "patrol" && e.hp > 0 ? target : undefined,
    lockedDirection:
      e.phase === "windup" || e.phase === "strike" ? e.attackDir : undefined,
    x: e.x,
    y: e.y,
    instance: action === "walk" ? undefined : `${e.id}:${action}:${at}`,
    clock,
    facing: e.dir,
    action,
    age: clock - at,
    vx:
      action === "walk"
        ? e.dir * (e.type ? 32 : 24)
        : action === "strike"
          ? e.attackDir * (e.type ? 340 : 290)
          : 0,
    grounded: !e.type && e.liftVy === undefined,
    support: e.type
      ? undefined
      : { id: e.id, x: e.minX, y: e.floor, left: e.minX, right: e.maxX },
    hitDirection: e.hitDirection,
    reduced,
  };
}
export function guardianAction(
  b: DewGuardian,
  clock: number,
  reduced = false,
  visible = true,
  target?: import("./action-a/intent/controller").IntentTarget,
): ActorInput {
  const map: Record<string, Action> = {
    sleep: "idle",
    intro: "start",
    stalk: "walk",
    warn: "windup",
    charge: "strike",
    "slam-warn": "slam-warn",
    slam: "slam",
    recover: "recover",
    bound: "bound",
    defeated: "defeat",
    "crystal-warn": "crystal-warn",
    crystal: "crystal",
    "garden-warn": "garden-warn",
    garden: "garden",
    "radiance-warn": "radiance-warn",
    radiance: "radiance",
    "combo-gap": "recover",
  };
  return {
    intentTarget: !["sleep", "defeated", "intro"].includes(b.phase)
      ? target
      : undefined,
    lockedDirection: [
      "warn",
      "charge",
      "slam-warn",
      "slam",
      "crystal-warn",
      "crystal",
      "garden-warn",
      "garden",
      "radiance-warn",
      "radiance",
    ].includes(b.phase)
      ? b.facing
      : undefined,
    x: b.x,
    y: b.y,
    clock,
    facing: b.facing,
    action: map[b.phase],
    instance: `guardian:${b.phase}:${b.phaseAt}`,
    age: clock - b.phaseAt,
    vx:
      b.phase === "charge"
        ? b.facing * 420
        : b.phase === "stalk"
          ? b.facing * 34
          : 0,
    grounded: true,
    support: {
      id: "guardian-floor",
      x: GUARDIAN.left,
      y: b.y,
      left: GUARDIAN.left,
      right: GUARDIAN.right,
    },
    reduced,
    visible,
  };
}
