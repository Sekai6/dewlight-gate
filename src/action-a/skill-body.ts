import type { SkillPose } from "../action-skill/types";

export function skillFootOffset(
  pose: SkillPose | undefined,
  side: number,
  airWeight: number,
  out: { x: number; y: number },
) {
  out.x = out.y = 0;
  if (!pose || airWeight <= 0) return out;
  const duration = pose.id === "bloom" ? 0.76 : pose.id === "rise" ? 0.5 : 0.38;
  const progress = Math.max(0, Math.min(1, pose.age / duration));
  const envelope = Math.sin(progress * Math.PI) ** 2 * Math.min(1, airWeight);
  if (pose.id === "branch") {
    out.x = (side ? -12 : -20) * envelope;
    out.y = (side ? -6 : -12) * envelope;
  } else if (pose.id === "rise") {
    out.x = (side ? 10 : -13) * envelope;
    out.y = (side ? -15 : -6) * envelope;
  } else {
    const sweep = Math.sin((pose.age - 0.08) * Math.PI * 12.5);
    out.x = (side ? 1 : -1) * (9 + sweep * 6) * envelope;
    out.y = (-11 + (side ? sweep : -sweep) * 5) * envelope;
  }
  return out;
}
