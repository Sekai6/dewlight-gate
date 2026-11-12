import type { SkillHit } from "./types.ts";
export interface SkillTarget {
  id: string;
  x: number;
  y: number;
  /** Extra reach granted to large targets. */
  padding?: number;
}
/** How far behind the caster a forward-facing hit still connects. */
const BEHIND = 30;
/** Root-space hit bands, independent from the rendered weapon and frame rate. */
export function skillContains(
  hit: SkillHit,
  root: { x: number; y: number },
  target: SkillTarget,
): boolean {
  return (
    Math.abs(target.y - root.y) < hit.height &&
    Math.abs(target.x - root.x) < hit.reach + (target.padding ?? 0) &&
    (!!hit.bothSides || (target.x - root.x) * hit.facing > -BEHIND)
  );
}
