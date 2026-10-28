import { clamp, sampleTrack, type Track, type BoneMask } from "./core.ts";
import type { Action } from "./rigs";

export interface CombatMotionDefinition {
  gripX: Track;
  gripY: Track;
  blade: Track;
  contact: number;
  airborne: { gripX: number; gripY: number; counter: number };
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
};
export function combatMotion(action: Action) {
  return COMBAT_MOTIONS[action as keyof typeof COMBAT_MOTIONS];
}
export function sampleWeapon(
  motion: CombatMotionDefinition,
  age: number,
  out: { x: number; y: number; rotation: number },
  airWeight = 0,
) {
  out.x = sampleTrack(motion.gripX, age);
  out.y = sampleTrack(motion.gripY, age);
  out.rotation = sampleTrack(motion.blade, age);
  const envelope = Math.sin(clamp(age / 0.38) * Math.PI) * airWeight;
  out.x += motion.airborne.gripX * envelope;
  out.y += motion.airborne.gripY * envelope;
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
  action: Action = "slash",
): BoneMask {
  const pulse = (delay: number) =>
    Math.sin(clamp((age - delay) / 0.29) * Math.PI);
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
  return out;
}
