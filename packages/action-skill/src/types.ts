export type SkillPhase = "anticipation" | "release" | "recovery";

/** One move as data. Times are seconds from the start of the cast. */
export interface SkillDefinition {
  id: string;
  cost: number;
  cooldown: number;
  duration: number;
  /** When the release and recovery phases begin. */
  release: number;
  recovery: number;
  /** Can only start off the ground. */
  airOnly?: boolean;
  /** One use per airtime; landing restores it. */
  oncePerAir?: boolean;
  /** Hits reach behind the caster as far as in front. */
  bothSides?: boolean;
  /** Other actions (by name) that may interrupt the recovery phase. Any
   *  skill may always follow from recovery. */
  cancelInto?: readonly string[];
  /** Once a hit of this skill has landed (see `SkillRuntime.confirm`), the
   *  listed actions and skill ids may interrupt it from `after` seconds on.
   *  "*" stands for every skill. A miss opens nothing. */
  hitCancel?: { after: number; into: readonly string[] };
  /** Hit bands around the caster. `end > at` keeps the band open. */
  hits: readonly { at: number; end: number; reach: number; height: number }[];
  /** Forced travel along the facing, replacing normal movement. */
  movement?: { start: number; end: number; distance: number };
  /** Vertical velocity set once at `at`. */
  launch?: { at: number; speed: number };
  /** Gravity multiplier until `end`. */
  gravity?: { end: number; scale: number };
}
export interface SkillInstance<Id extends string = string> {
  id: number;
  skill: Id;
  age: number;
  facing: number;
  phase: SkillPhase;
  /** One of its hits has landed on something. */
  confirmed: boolean;
}
export interface SkillInput {
  energy: number;
  grounded: boolean;
  facing: number;
  /** Stunned: the active skill and the buffered input are dropped. */
  blocked?: boolean;
  /** Busy with something else (a dash): nothing starts, the buffered input
   *  waits. */
  hold?: boolean;
}
/** Why a skill cannot start right now. */
export type SkillBlock =
  "blocked" | "air-only" | "once-per-air" | "cooldown" | "energy";
export interface SkillEvent<Id extends string = string> {
  type: "prepare" | "release" | "hit" | "recovery" | "complete" | "cancel";
  instance: number;
  skill: Id;
  at: number;
  section?: number;
}
export interface SkillHit<Id extends string = string> {
  instance: number;
  skill: Id;
  section: number;
  facing: number;
  reach: number;
  height: number;
  bothSides?: boolean;
}
export interface SkillSnapshot<Id extends string = string> {
  active: SkillInstance<Id> | null;
  cooldowns: Record<Id, number>;
  /** Once-per-air skills already used in this airtime. */
  spent: Id[];
  queued: Id | null;
}
export interface SkillStep<Id extends string = string> {
  cost: number;
  dx: number;
  launch: number | null;
  gravity: number;
  events: SkillEvent<Id>[];
  hits: SkillHit<Id>[];
}
export interface SkillPose<Id extends string = string> {
  instance: number;
  id: Id;
  phase: SkillPhase;
  age: number;
  progress: number;
}
