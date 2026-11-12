import type {
  SkillBlock,
  SkillDefinition,
  SkillPose as Pose,
} from "@dewlight/action-skill";

export type SkillId = "branch" | "rise" | "bloom";
export type SkillPose = Pose<SkillId>;
/** A sword-dance skill: the simulated move plus how the game presents it. */
export interface GameSkill extends SkillDefinition {
  id: SkillId;
  name: string;
  key: string;
  /** Effect size and how many half-turns the effect sweeps. */
  radius: number;
  turns: number;
}
export const SKILLS: Record<SkillId, GameSkill> = {
  branch: {
    id: "branch",
    name: "折光穿枝",
    key: "Q",
    cost: 20,
    cooldown: 3.5,
    duration: 0.38,
    release: 0.1,
    recovery: 0.26,
    cancelInto: ["dash"],
    hits: [{ at: 0.1, end: 0.24, reach: 112, height: 85 }],
    movement: { start: 0.1, end: 0.26, distance: 160 },
    radius: 48,
    turns: 1,
  },
  rise: {
    id: "rise",
    name: "藤芽升锋",
    key: "R",
    cost: 25,
    cooldown: 5,
    duration: 0.5,
    release: 0.14,
    recovery: 0.3,
    oncePerAir: true,
    cancelInto: ["dash"],
    hits: [{ at: 0.14, end: 0.14, reach: 110, height: 150 }],
    launch: { at: 0.14, speed: -480 },
    radius: 42,
    turns: 1,
  },
  bloom: {
    id: "bloom",
    name: "露华回旋",
    key: "F",
    cost: 35,
    cooldown: 8,
    duration: 0.76,
    release: 0.14,
    recovery: 0.52,
    airOnly: true,
    bothSides: true,
    cancelInto: ["dash", "attack"],
    hits: [0.14, 0.3, 0.46].map((at) => ({
      at,
      end: at,
      reach: 130,
      height: 115,
    })),
    gravity: { end: 0.48, scale: 0.2 },
    radius: 60,
    turns: 6,
  },
};
export const SKILL_IDS: readonly SkillId[] = ["branch", "rise", "bloom"];

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
