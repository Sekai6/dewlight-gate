import type {
  SkillBlock,
  SkillDefinition,
  SkillPose as Pose,
} from "@dewlight/action-skill";

export type AttackId = "slash1" | "slash2" | "slash3" | "air";
export type SkillId = "branch" | "rise" | "bloom";
export type MoveId = AttackId | SkillId;
export type MovePose = Pose<MoveId>;
export type SkillPose = Pose<SkillId>;

/** What landing a hit feels like. */
export interface HitFeel {
  /** Seconds the simulation freezes. */
  hitstop: number;
  /** Camera shake intensity. */
  shake: number;
  /** Light energy returned per target hit. */
  energy: number;
  /** How far a creature is shoved, in pixels. */
  push: number;
  /** Draws creatures toward the caster until the last or killing hit,
   *  which flings them away. */
  pull?: boolean;
  /** Tosses creatures into the air. */
  lift?: boolean;
  /** Pitch of the contact sound. */
  sound: number;
  /** Size of the spark at the point of contact, 0..1. */
  spark: number;
}
/** Everything the hero can swing: sword attacks and sword-dance skills run on
 *  one runtime, so they buffer, chain and cancel into each other. */
export interface GameMove extends SkillDefinition {
  id: MoveId;
  kind: "attack" | "skill";
  /** The animation action that plays it. */
  action: string;
  feel: HitFeel;
}
export interface GameSkill extends GameMove {
  id: SkillId;
  kind: "skill";
  name: string;
  key: string;
  /** Effect colour, size, and how many half-turns the effect sweeps. */
  color: number;
  radius: number;
  ring: number;
  turns: number;
}

const SWING = {
  cost: 0,
  cooldown: 0,
  duration: 0.38,
  release: 0.065,
  recovery: 0.24,
  cancelInto: ["dash", "jump", "bind"],
  // A swing that connects flows straight into the next move.
  hitCancel: { after: 0.15, into: ["*", "dash", "jump"] },
} as const;
const light: HitFeel = {
  hitstop: 0.045,
  shake: 0.0015,
  energy: 0,
  push: 12,
  sound: 115,
  spark: 0.5,
};

export const SWORD_ATTACKS: Record<AttackId, GameMove> = {
  slash1: {
    ...SWING,
    id: "slash1",
    kind: "attack",
    action: "slash",
    hits: [{ at: 0.085, end: 0.085, reach: 102, height: 85 }],
    feel: light,
  },
  slash2: {
    ...SWING,
    id: "slash2",
    kind: "attack",
    action: "rising-slash",
    hits: [{ at: 0.085, end: 0.085, reach: 102, height: 85 }],
    feel: { ...light, sound: 130 },
  },
  /** The finisher steps in and hits hard. */
  slash3: {
    ...SWING,
    id: "slash3",
    kind: "attack",
    action: "finisher",
    duration: 0.46,
    release: 0.08,
    recovery: 0.3,
    hitCancel: { after: 0.2, into: ["*", "dash", "jump"] },
    hits: [{ at: 0.1, end: 0.1, reach: 124, height: 95 }],
    movement: { start: 0.03, end: 0.13, distance: 44 },
    feel: {
      hitstop: 0.08,
      shake: 0.003,
      energy: 0,
      push: 52,
      sound: 92,
      spark: 1,
    },
  },
  air: {
    ...SWING,
    id: "air",
    kind: "attack",
    action: "air-slash",
    airOnly: true,
    hits: [{ at: 0.085, end: 0.085, reach: 102, height: 95 }],
    feel: light,
  },
};
export const SKILLS: Record<SkillId, GameSkill> = {
  branch: {
    id: "branch",
    kind: "skill",
    action: "skill-branch",
    name: "折光穿枝",
    key: "Q",
    cost: 20,
    cooldown: 3.5,
    duration: 0.38,
    release: 0.1,
    recovery: 0.26,
    cancelInto: ["dash"],
    hitCancel: { after: 0.2, into: ["*", "dash", "jump"] },
    hits: [{ at: 0.1, end: 0.24, reach: 112, height: 85 }],
    movement: { start: 0.1, end: 0.26, distance: 160 },
    feel: {
      hitstop: 0.05,
      shake: 0.002,
      energy: 4,
      push: 44,
      sound: 580,
      spark: 0.8,
    },
    color: 0xb2eee0,
    radius: 48,
    ring: 48,
    turns: 1,
  },
  rise: {
    id: "rise",
    kind: "skill",
    action: "skill-rise",
    name: "藤芽升锋",
    key: "R",
    cost: 25,
    cooldown: 5,
    duration: 0.5,
    release: 0.14,
    recovery: 0.3,
    oncePerAir: true,
    cancelInto: ["dash"],
    hitCancel: { after: 0.22, into: ["*", "dash"] },
    hits: [{ at: 0.14, end: 0.14, reach: 110, height: 150 }],
    launch: { at: 0.14, speed: -480 },
    feel: {
      hitstop: 0.06,
      shake: 0.0025,
      energy: 4,
      push: 8,
      lift: true,
      sound: 640,
      spark: 0.9,
    },
    color: 0xd5ecb5,
    radius: 42,
    ring: 34,
    turns: 1,
  },
  bloom: {
    id: "bloom",
    kind: "skill",
    action: "skill-bloom",
    name: "露华回旋",
    key: "F",
    cost: 35,
    cooldown: 8,
    duration: 0.76,
    release: 0.14,
    recovery: 0.52,
    airOnly: true,
    bothSides: true,
    cancelInto: ["dash"],
    hits: [0.14, 0.3, 0.46].map((at) => ({
      at,
      end: at,
      reach: 130,
      height: 115,
    })),
    gravity: { end: 0.48, scale: 0.2 },
    feel: {
      hitstop: 0.03,
      shake: 0.0015,
      energy: 3,
      push: 22,
      pull: true,
      sound: 850,
      spark: 0.6,
    },
    color: 0xffe7b8,
    radius: 60,
    ring: 42,
    turns: 6,
  },
};
export const MOVES: Record<MoveId, GameMove> = { ...SWORD_ATTACKS, ...SKILLS };
export const SKILL_IDS: readonly SkillId[] = ["branch", "rise", "bloom"];
export const isSkill = (id: MoveId): id is SkillId =>
  MOVES[id].kind === "skill";

/** Seconds after a swing starts in which the next press continues the combo. */
const COMBO_WINDOW = 0.85;
/** Which sword attack the next press performs: three ground swings in a row
 *  ending in the finisher, or the air slash off the ground. */
export function nextAttack(
  grounded: boolean,
  last: MoveId | undefined,
  sinceLast: number,
): AttackId {
  if (!grounded) return "air";
  const previous = sinceLast < COMBO_WINDOW ? last : undefined;
  return previous === "slash1"
    ? "slash2"
    : previous === "slash2"
      ? "slash3"
      : "slash1";
}

/** Player-facing wording for why a skill is unavailable. */
export function skillBlockText(block: SkillBlock | null, cooldown: number) {
  return block === "blocked"
    ? "失衡中"
    : block === "air-only"
      ? "仅空中"
      : block === "once-per-air"
        ? "落地后恢复"
        : block === "cooldown"
          ? `${cooldown.toFixed(1)}s`
          : block === "energy"
            ? "光能不足"
            : "";
}
