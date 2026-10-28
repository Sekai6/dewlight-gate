import { clamp, sampleTrack, type Track, type BoneMask } from "./core.ts";
import type { Action } from "./rigs";

export interface CombatMotionDefinition {
  gripX: Track;
  gripY: Track;
  blade: Track;
  contact: number;
}
const times = [0, 0.055, 0.085, 0.145, 0.25, 0.38];
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
});
export const COMBAT_MOTIONS = {
  slash: definition(false),
  "rising-slash": definition(true),
  "air-slash": definition(false),
};
export function combatMotion(action: Action) {
  return COMBAT_MOTIONS[action as keyof typeof COMBAT_MOTIONS];
}
export function sampleWeapon(
  motion: CombatMotionDefinition,
  age: number,
  out: { x: number; y: number; rotation: number },
) {
  out.x = sampleTrack(motion.gripX, age);
  out.y = sampleTrack(motion.gripY, age);
  out.rotation = sampleTrack(motion.blade, age);
  return out;
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
): BoneMask {
  const release = Math.sin(clamp(age / 0.24) * Math.PI);
  out.hip = moving ? { x: 0.3 + release * 0.2, y: 0.25, rotation: 0.4 } : 1;
  out.root = 1;
  out.torso = 1;
  out.head = 0.75;
  out.arm = 1;
  out.fore = 1;
  out.weapon = 1;
  out.armBack = 0.85;
  out.foreBack = 0.85;
  return out;
}
