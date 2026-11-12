import { clamp, type Track, type BoneMask } from "@dewlight/action-a";
import type { CombatMotionDefinition } from "@dewlight/action-a";
import { SKILL_DURATION, TIMING } from "./actions.ts";
import { SKILLS, SWORD_ATTACKS } from "./skills.ts";

const SLASH3 = SWORD_ATTACKS.slash3;

const { branch: BRANCH, rise: RISE, bloom: BLOOM } = SKILLS;

const times = [0, 0.055, 0.085, 0.145, 0.25, TIMING.attack];
function curve(
  values: number[],
  bone: string,
  channel: Track["channel"],
): Track {
  return {
    bone,
    channel,
    interpolation: "hermite",
    unwrapped: true,
    keys: values.map((value, i) => {
      const tangent =
        i === 0 || i === values.length - 1
          ? 0
          : (values[i + 1] - values[i - 1]) / (times[i + 1] - times[i - 1]);
      return { time: times[i], value, tangentIn: tangent, tangentOut: tangent };
    }),
  };
}
const definition = (up: boolean): CombatMotionDefinition => ({
  duration: TIMING.attack,
  trail: [0.06, 0.24],
  gripX: curve(
    up ? [6, 2, 23, 13, 8, 6] : [6, -2, 25, 25, 13, 6],
    "weapon",
    "x",
  ),
  gripY: curve(
    up ? [19, 24, 5, -12, 6, 19] : [19, 4, 5, 17, 22, 19],
    "weapon",
    "y",
  ),
  blade: curve(
    up ? [0.4, 2.3, 0.5, -0.85, -0.1, 0.4] : [0.4, -1.15, 1.15, 2.55, 1.1, 0.4],
    "weapon",
    "rotation",
  ),
  contact: 0.085,
  airborne: {
    gripX: up ? -1 : -2,
    gripY: up ? -3 : -2,
    counter: up ? -0.2 : 0.18,
  },
});
export const COMBAT_MOTIONS = {
  slash: definition(false),
  "rising-slash": definition(true),
  "air-slash": definition(false),
  // Raised overhead, then driven down past the front foot.
  finisher: skillMotion(
    [0, 0.05, SLASH3.hits[0].at, 0.18, 0.32, SLASH3.duration],
    [0.06, 0.3],
    [6, -4, 22, 27, 16, 6],
    [19, -14, -6, 22, 25, 19],
    [0.4, -1, 0.6, 2.7, 1.6, 0.4],
  ),
  "skill-branch": skillMotion(
    [0, 0.07, BRANCH.release, 0.17, BRANCH.recovery, BRANCH.duration],
    [0.09, 0.26],
    [6, -5, 20, 21, 12, 6],
    [19, 2, 3, 8, 20, 19],
    [0.4, -1.4, 0.2, 1.7, 2.5, 0.4],
  ),
  "skill-rise": skillMotion(
    [0, 0.09, RISE.release, 0.23, 0.34, RISE.duration],
    [0.12, 0.34],
    [6, 4, 20, 7, 10, 6],
    [19, 21, 0, -20, -10, 19],
    [0.4, 2.3, 0.5, -1.8, -2.5, 0.4],
  ),
  "skill-bloom": skillMotion(
    [
      0,
      0.08,
      BLOOM.hits[0].at,
      0.22,
      BLOOM.hits[1].at,
      0.38,
      BLOOM.hits[2].at,
      0.57,
      BLOOM.duration,
    ],
    [0.12, 0.53],
    [6, 2, 21, -4, 21, -4, 21, 11, 6],
    [19, 5, 1, -18, 1, -18, 1, 16, 19],
    [0.4, -1.4, 1.1, 4.2, 7.4, 10.5, 13.7, 15.6, 13],
  ),
};
function skillMotion(
  ts: number[],
  trail: readonly [number, number],
  xs: number[],
  ys: number[],
  angles: number[],
): CombatMotionDefinition {
  const make = (values: number[], channel: Track["channel"]): Track => ({
    bone: "weapon",
    channel,
    unwrapped: true,
    interpolation: "hermite",
    keys: values.map((value, i) => {
      const tangent =
        i === 0 || i === values.length - 1
          ? 0
          : (values[i + 1] - values[i - 1]) / (ts[i + 1] - ts[i - 1]);
      return { time: ts[i], value, tangentIn: tangent, tangentOut: tangent };
    }),
  });
  return {
    gripX: make(xs, "x"),
    gripY: make(ys, "y"),
    blade: make(angles, "rotation"),
    duration: ts[ts.length - 1],
    trail,
    contact: ts[2],
    airborne: { gripX: -1, gripY: -2, counter: 0.2 },
  };
}
export function combatMotion(action: string) {
  return COMBAT_MOTIONS[action as keyof typeof COMBAT_MOTIONS];
}
export function combatMask(
  age: number,
  moving: boolean,
  out: Record<
    string,
    | number
    | Partial<
        Record<"x" | "y" | "rotation" | "scaleX" | "scaleY" | "alpha", number>
      >
  >,
  action: string = "slash",
): BoneMask {
  // Each skill has its own phase envelope and pelvis/counter-arm participation.
  const skillDuration =
    action === "skill-rise"
      ? SKILL_DURATION.rise
      : action === "skill-bloom"
        ? SKILL_DURATION.bloom
        : SKILL_DURATION.branch;
  const sampleAge = action.startsWith("skill-")
    ? (age * TIMING.attack) / skillDuration
    : age;
  const pulse = (delay: number) =>
    Math.sin(clamp((sampleAge - delay) / 0.29) * Math.PI);
  const hip = typeof out.hip === "object" ? out.hip : (out.hip = {});
  hip.x = moving ? 0.3 + pulse(0) * 0.25 : 0.8 + pulse(0) * 0.2;
  hip.y = moving ? 0.28 : 1;
  hip.rotation = moving ? 0.4 : 1;
  hip.scaleX = hip.scaleY = hip.alpha = 1;
  out.root = 1;
  out.torso = 0.8 + pulse(0.012) * 0.2;
  out.head = 0.65 + pulse(0.03) * 0.15;
  out.arm = 0.85 + pulse(0.02) * 0.15;
  out.fore = 0.85 + pulse(0.03) * 0.15;
  out.weapon = 1;
  out.armBack = (action === "rising-slash" ? 0.75 : 0.65) + pulse(0.025) * 0.2;
  out.foreBack = 0.65 + pulse(0.04) * 0.2;
  if (action === "skill-branch") {
    hip.x = 0.55 + pulse(0) * 0.4;
    hip.rotation = 0.7 + pulse(0.01) * 0.3;
    out.armBack = 0.9;
    out.head = 0.7;
  } else if (action === "skill-rise") {
    hip.y = 0.85 + pulse(0) * 0.15;
    out.torso = 0.9 + pulse(0.015) * 0.1;
    out.armBack = 0.8 + pulse(0.04) * 0.2;
  } else if (action === "skill-bloom") {
    hip.x = 0.45;
    hip.rotation = 0.8;
    out.torso = 1;
    out.head = 0.9;
    out.armBack = 0.95;
    out.foreBack = 0.9;
  }
  return out;
}
