/** The action vocabulary and its shared timing. Every module reads names and
 *  durations from here, so a retimed action changes in exactly one place. */
export const ACTIONS = [
  "skill-branch",
  "skill-rise",
  "skill-bloom",
  "crystal-warn",
  "crystal",
  "garden-warn",
  "garden",
  "radiance-warn",
  "radiance",
  "idle",
  "walk",
  "run",
  "start",
  "brake",
  "turn",
  "launch",
  "rise",
  "apex",
  "fall",
  "land",
  "slash",
  "rising-slash",
  "air-slash",
  "dash",
  "bind",
  "hurt",
  "defeat",
  "windup",
  "strike",
  "recover",
  "bound",
  "slam-warn",
  "slam",
] as const;
export type Action = (typeof ACTIONS)[number];

/** Skill state mirrored from gameplay; structurally matches the game's SkillPose. */
export interface SkillPose {
  instance: number;
  id: "branch" | "rise" | "bloom";
  phase: "anticipation" | "release" | "recovery";
  age: number;
}

const group = (...actions: Action[]): ReadonlySet<string> => new Set(actions);

/** Sword attacks: one latched instance, three-phase timing. */
export const ATTACKS = group("slash", "rising-slash", "air-slash");
/** Played on the combat layer. */
export const COMBAT_ACTIONS = group(
  "skill-branch",
  "skill-rise",
  "skill-bloom",
  "crystal-warn",
  "crystal",
  "garden-warn",
  "garden",
  "radiance-warn",
  "radiance",
  "slash",
  "rising-slash",
  "air-slash",
  "bind",
  "dash",
  "windup",
  "strike",
  "recover",
  "slam-warn",
  "slam",
);
/** Played on the reaction layer. */
export const REACTIONS = group("hurt", "defeat", "bound");
/** Short locomotion clips chosen by the driver rather than derived from velocity. */
export const TRANSITIONS = group("launch", "land", "turn", "brake", "start");
export const LOOPING = group(
  "idle",
  "walk",
  "run",
  "rise",
  "apex",
  "fall",
  "bound",
);
/** Grounded, moving attacks that keep the locomotion lower body. */
export const UPPER_BODY_COMBAT = group(
  "slash",
  "rising-slash",
  "air-slash",
  "bind",
);
/** The root carries the body; feet neither plant nor step. */
export const UNPLANTED = group("dash", "skill-branch", "defeat");
/** Travel does not advance the gait cycle. */
export const GAIT_FROZEN = group("dash", "skill-branch", "defeat", "hurt");
/** No stepping even while the root moves. */
export const STEP_BLOCKED = group(
  "dash",
  "skill-branch",
  "defeat",
  "hurt",
  "bound",
);
/** Each new instance fires one body impulse. */
export const IMPULSIVE = group(
  "skill-branch",
  "skill-rise",
  "skill-bloom",
  "crystal",
  "garden",
  "radiance",
  "slash",
  "rising-slash",
  "air-slash",
  "dash",
  "strike",
  "slam",
  "hurt",
);
/** Player actions that cut the post-hit recovery fade short. */
export const RECOVERY_CANCEL = group(
  "slash",
  "rising-slash",
  "air-slash",
  "dash",
  "bind",
  "launch",
  "hurt",
);
const ANTICIPATIONS = group("windup", "slam-warn");
const RELEASES = group("strike", "slam", "dash");

/** Seconds. Clip lengths and the driver windows that select those clips. */
export const TIMING = {
  attack: 0.38,
  /** Attack phases: anticipation until `attackRelease`, release until `attackRecovery`. */
  attackRelease: 0.065,
  attackRecovery: 0.16,
  dash: 0.19,
  bind: 0.45,
  hurtHero: 0.24,
  hurt: 0.2,
  defeat: 0.65,
  turn: 0.16,
  brake: 0.18,
  start: 0.16,
  launch: 0.16,
  land: 0.22,
  recover: 0.45,
  slamWarn: 1.05,
} as const;
export const SKILL_DURATION = { branch: 0.38, rise: 0.5, bloom: 0.76 } as const;

export function attackPhase(age: number) {
  return age < TIMING.attackRelease
    ? "anticipation"
    : age < TIMING.attackRecovery
      ? "release"
      : "recovery";
}
/** Coarse stage label for diagnostics. */
export function actionStage(action: Action, age: number): string {
  return ANTICIPATIONS.has(action)
    ? "anticipation"
    : RELEASES.has(action)
      ? "release"
      : action === "hurt"
        ? "impact"
        : ATTACKS.has(action)
          ? attackPhase(age)
          : action;
}
