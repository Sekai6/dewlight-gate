export type SkillId = "branch" | "rise" | "bloom";
export type SkillPhase = "anticipation" | "release" | "recovery";
export type Difficulty = "normal" | "challenge";
export interface DifficultyProfile {
  id: Difficulty;
  hp: number;
  warningScale: number;
  recovery: number;
  comboGap: number;
}
export interface SkillDefinition {
  id: SkillId;
  name: string;
  key: "Q" | "R" | "F";
  cost: number;
  cooldown: number;
  duration: number;
  release: number;
  recovery: number;
  airOnly?: boolean;
  hits: readonly { at: number; end: number; reach: number; height: number }[];
  movement?: { start: number; end: number; distance: number };
  launch?: { at: number; speed: number };
  gravity?: { end: number; scale: number };
}
export interface SkillInstance {
  id: number;
  skill: SkillId;
  age: number;
  facing: number;
  phase: SkillPhase;
}
export interface SkillInput {
  energy: number;
  grounded: boolean;
  facing: number;
  blocked?: boolean;
}
export interface SkillEvent {
  type: "prepare" | "release" | "hit" | "recovery" | "complete" | "cancel";
  instance: number;
  skill: SkillId;
  at: number;
  section?: number;
}
export interface SkillHit {
  instance: number;
  skill: SkillId;
  section: number;
  facing: number;
  reach: number;
  height: number;
}
export interface SkillSnapshot {
  active: SkillInstance | null;
  cooldowns: Record<SkillId, number>;
  riseUsed: boolean;
  queued: SkillId | null;
}
export interface SkillStep {
  cost: number;
  dx: number;
  launch: number | null;
  gravity: number;
  events: SkillEvent[];
  hits: SkillHit[];
}
export interface SkillPose {
  instance: number;
  id: SkillId;
  phase: SkillPhase;
  age: number;
  progress: number;
}
