import type { SkillHit } from "./types";
export interface SkillTarget {
  id: string;
  x: number;
  y: number;
  boss?: boolean;
}
/** Root-space hit bands, independent from the rendered weapon and frame rate. */
export function skillContains(
  hit: SkillHit,
  root: { x: number; y: number },
  target: SkillTarget,
): boolean {
  return (
    Math.abs(target.y - root.y) < hit.height &&
    Math.abs(target.x - root.x) < hit.reach + (target.boss ? 25 : 0) &&
    (hit.skill === "bloom" || (target.x - root.x) * hit.facing > -30)
  );
}
