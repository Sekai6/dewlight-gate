import { GUARDIAN } from "./boss";
import type { HeroPose } from "./art";
import { creatureTuning, type Enemy } from "./creature";
import type { DewGuardian } from "./boss";
import type { ActorInput } from "@dewlight/action-a";
import { TIMING, type Action } from "./content/actions.ts";
import { MOVES } from "./content/skills.ts";

export function heroAction(p: HeroPose, reduced = false): ActorInput {
  let action: string = "idle",
    age = p.clock;
  const since = (at = -999) => p.clock - at;
  const choose = (name: Action, at: number) => {
    action = name;
    age = since(at);
  };
  if (p.dollPose?.active) choose("hurt", p.hurtAt);
  else if (since(p.hurtAt) >= 0 && since(p.hurtAt) < TIMING.hurtHero)
    choose("hurt", p.hurtAt);
  else if (p.movePose) {
    // Sword attacks and skills are both moves; each names its own action.
    action = MOVES[p.movePose.id].action;
    age = p.movePose.age;
  } else if (since(p.dashAt) >= 0 && since(p.dashAt) < TIMING.dash)
    choose("dash", p.dashAt);
  else if (since(p.bindAt) >= 0 && since(p.bindAt) < TIMING.bind)
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

    y: p.y,
    instance: p.movePose ? `move:${p.movePose.instance}` : undefined,
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

    hitDirection: p.hitDirection,
  };
}
export function creatureAction(
  e: Enemy,
  clock: number,
  reduced = false,
  target?: import("@dewlight/action-a").IntentTarget,
): ActorInput {
  const corpse = e.hp <= 0 ? e.corpse : undefined;
  if (corpse && !reduced)
    // Knocked out: the body tumbles as a ragdoll, then fades where it rests.
    return {
      x: e.x,
      y: e.y,
      clock,
      facing: e.dir,
      action: "hurt",
      age: clock - e.diedAt,
      instance: `${e.id}:defeat`,
      vx: corpse.vx,
      vy: corpse.vy,
      grounded: e.y >= e.floor,
      doll: corpse.doll.state,
      dollFloor: e.floor - e.y,
      hitDirection: e.hitDirection,
      alpha:
        corpse.restAt === undefined
          ? 1
          : Math.min(1, Math.max(0, 1 - (clock - corpse.restAt - 0.25) / 0.4)),
    };
  const tune = creatureTuning(e);
  // Pacing, chasing and backing off are all locomotion; the gait follows
  // the real displacement.
  const roaming =
    e.phase === "patrol" || e.phase === "return" || e.phase === "engage";
  const action: string =
    e.hp <= 0
      ? "defeat"
      : e.bound > clock
        ? "bound"
        : clock - e.hurtAt < TIMING.hurt
          ? "hurt"
          : roaming
            ? "walk"
            : e.phase;
  const at =
    action === "defeat" ? e.diedAt : action === "hurt" ? e.hurtAt : e.phaseAt;
  const left = e.edgeMin ?? e.minX,
    right = e.edgeMax ?? e.maxX;
  return {
    intentTarget:
      e.phase !== "patrol" && e.phase !== "return" && e.hp > 0
        ? target
        : undefined,
    lockedDirection:
      e.phase === "windup" || e.phase === "strike" ? e.attackDir : undefined,
    x: corpse?.x ?? e.x,
    y: corpse?.y ?? e.y,
    instance: action === "walk" ? undefined : `${e.id}:${action}:${at}`,
    clock,
    facing: e.dir,
    action,
    age: clock - at,
    vx: action === "strike" ? e.attackDir * tune.strikeSpeed : 0,
    grounded: !tune.flying && e.liftVy === undefined && e.phase !== "hop",
    support: tune.flying
      ? undefined
      : { id: e.id, x: left, y: e.floor, left, right },
    hitDirection: e.hitDirection,
    reduced,
  };
}
export function guardianAction(
  b: DewGuardian,
  clock: number,
  reduced = false,
  visible = true,
  target?: import("@dewlight/action-a").IntentTarget,
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
  // A landed blade rocks the body back over its planted feet.
  const u = (clock - b.flinchAt) / 0.24;
  const flinch =
    reduced || u < 0 || u >= 1
      ? 0
      : b.flinchDir * 9 * Math.sin(Math.PI * u) * (1 - u);
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
    x: b.x + flinch,
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
