import type { DifficultyProfile, SkillDefinition, SkillId } from "./types";
export const SKILLS: Record<SkillId, SkillDefinition> = {
  branch: {
    id: "branch",
    name: "折光穿枝",
    key: "Q",
    cost: 20,
    cooldown: 3.5,
    duration: 0.38,
    release: 0.1,
    recovery: 0.26,
    hits: [{ at: 0.1, end: 0.24, reach: 112, height: 85 }],
    movement: { start: 0.1, end: 0.26, distance: 160 },
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
    hits: [{ at: 0.14, end: 0.14, reach: 110, height: 150 }],
    launch: { at: 0.14, speed: -480 },
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
    hits: [0.14, 0.3, 0.46].map((at) => ({
      at,
      end: at,
      reach: 130,
      height: 115,
    })),
    gravity: { end: 0.48, scale: 0.2 },
  },
};
export const DIFFICULTIES: Record<string, DifficultyProfile> = {
  normal: {
    id: "normal",
    hp: 48,
    warningScale: 1,
    recovery: 1.6,
    comboGap: 0.45,
  },
  challenge: {
    id: "challenge",
    hp: 64,
    warningScale: 0.8,
    recovery: 1.2,
    comboGap: 0.45,
  },
};
export const SKILL_IDS: readonly SkillId[] = ["branch", "rise", "bloom"];
