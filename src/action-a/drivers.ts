import type { HeroPose } from "../art";
import type { Enemy } from "../creature";
import type { DewGuardian } from "../boss";
import type { ActorInput } from "./actor";
import type { Action } from "./rigs";

export function heroAction(p: HeroPose, reduced = false): ActorInput {
  let action: Action = "idle",
    age = p.clock;
  const since = (at = -999) => p.clock - at;
  const choose = (name: Action, at: number) => {
    action = name;
    age = since(at);
  };
  if (p.dollPose?.active) choose("hurt", p.hurtAt);
  else if (since(p.hurtAt) >= 0 && since(p.hurtAt) < 0.24)
    choose("hurt", p.hurtAt);
  else if (since(p.dashAt) >= 0 && since(p.dashAt) < 0.19)
    choose("dash", p.dashAt);
  else if (since(p.attackAt) >= 0 && since(p.attackAt) < 0.38) {
    // attackStyle is stable for this attack; landing must not restart its clip.
    choose(p.attackStyle ? "rising-slash" : "slash", p.attackAt);
  } else if (since(p.bindAt) >= 0 && since(p.bindAt) < 0.45)
    choose("bind", p.bindAt);
  else if (!p.onGround && since(p.launchAt) < 0.16)
    choose("launch", p.launchAt!);
  else if (!p.onGround)
    action = p.vy < -80 ? "rise" : p.vy > 80 ? "fall" : "apex";
  else if (since(p.landAt) < 0.22 && Math.abs(p.vx) < 80)
    choose("land", p.landAt!);
  else if (since(p.turnAt) < 0.16) choose("turn", p.turnAt!);
  else if (since(p.brakeAt) < 0.18) choose("brake", p.brakeAt!);
  else if (Math.abs(p.vx) > 5) action = Math.abs(p.vx) > 180 ? "run" : "walk";
  return {
    x: p.x,
    doll: p.dollPose ?? undefined,
    dollFloor: p.dollFloor,
    attackSegment: p.attackStyle ? 2 : 1,
    y: p.y,
    instance: ["slash", "rising-slash", "air-slash"].includes(action)
      ? `attack:${p.attackAt}`
      : undefined,
    support: p.support,
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
    combatPhase:
      age < 0.065 ? "anticipation" : age < 0.16 ? "release" : "recovery",
  };
}
export function creatureAction(
  e: Enemy,
  clock: number,
  reduced = false,
): ActorInput {
  const action: Action =
    e.hp <= 0
      ? "defeat"
      : e.bound > clock
        ? "bound"
        : clock - e.hurtAt < 0.2
          ? "hurt"
          : e.phase === "patrol"
            ? "walk"
            : e.phase;
  const at =
    action === "defeat" ? e.diedAt : action === "hurt" ? e.hurtAt : e.phaseAt;
  return {
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
    grounded: !e.type,
    hitDirection: e.hitDirection,
    reduced,
  };
}
export function guardianAction(
  b: DewGuardian,
  clock: number,
  reduced = false,
  visible = true,
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
  };
  return {
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
    reduced,
    visible,
  };
}
