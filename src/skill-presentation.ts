import { SKILLS, type SkillPose } from "./content/skills.ts";

export interface SkillPresentation {
  anticipation: number;
  release: number;
  recovery: number;
  impact: number;
  turn: number;
  radius: number;
}

const saturate = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = saturate(value);
  return t * t * (3 - 2 * t);
};

export function samplePresentation(
  pose: SkillPose,
  out: SkillPresentation,
): SkillPresentation {
  const definition = SKILLS[pose.id];
  const age = Math.max(0, Math.min(definition.duration, pose.age));
  out.anticipation =
    smooth(age / definition.release) *
    (1 - smooth((age - definition.release) / 0.06));
  out.release =
    smooth((age - definition.release + 0.035) / 0.055) *
    (1 -
      smooth(
        (age - definition.recovery) /
          Math.min(0.13, definition.duration - definition.recovery),
      ));
  out.recovery = smooth(
    (age - definition.recovery) / (definition.duration - definition.recovery),
  );
  out.impact = 0;
  for (const hit of definition.hits) {
    const elapsed = age - hit.at;
    if (elapsed >= 0 && elapsed < 0.12)
      out.impact = Math.max(out.impact, (1 - elapsed / 0.12) ** 2);
  }
  const travel = smooth(
    (age - definition.release) / (definition.recovery - definition.release),
  );
  out.turn = travel * Math.PI * definition.turns;
  out.radius = definition.radius * (0.35 + 0.65 * out.release);
  return out;
}

export function createPresentation(): SkillPresentation {
  return {
    anticipation: 0,
    release: 0,
    recovery: 0,
    impact: 0,
    turn: 0,
    radius: 0,
  };
}
