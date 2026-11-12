import type { ActionTraits } from "@dewlight/action-a";
import { SKILLS, type SkillPose } from "./skills.ts";

export type { SkillPose };

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
export const SKILL_DURATION = {
  branch: SKILLS.branch.duration,
  rise: SKILLS.rise.duration,
  bloom: SKILLS.bloom.duration,
};

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

/** The traits the animation engine reads, derived from the lists above. */
export const ACTION_TRAITS: Record<string, ActionTraits> = Object.fromEntries(
  ACTIONS.map((action): [string, ActionTraits] => {
    const attack = ATTACKS.has(action);
    return [
      action,
      {
        layer: REACTIONS.has(action)
          ? "reaction"
          : COMBAT_ACTIONS.has(action)
            ? "combat"
            : undefined,
        blend: action === "hurt" ? "additive" : undefined,
        transition: TRANSITIONS.has(action),
        upperBody: UPPER_BODY_COMBAT.has(action),
        unplanted: UNPLANTED.has(action),
        gaitFrozen: GAIT_FROZEN.has(action),
        stepBlocked: STEP_BLOCKED.has(action),
        feetFollowRoot: action === "defeat",
        impulse: !IMPULSIVE.has(action)
          ? undefined
          : action === "hurt"
            ? "hit"
            : action === "rising-slash"
              ? -1
              : 1,
        recoveryCancel: RECOVERY_CANCEL.has(action),
        latched: attack,
        mirrorsHit: action === "hurt",
        echo: action === "dash",
        phases: attack
          ? [TIMING.attackRelease, TIMING.attackRecovery]
          : undefined,
        stage: ANTICIPATIONS.has(action)
          ? "anticipation"
          : RELEASES.has(action)
            ? "release"
            : action === "hurt"
              ? "impact"
              : undefined,
      },
    ];
  }),
);
