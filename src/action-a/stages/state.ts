import type { Action, SkillPose } from "../actions.ts";
import type { CanvasPart } from "../canvas";
import { ContactController } from "../contact/controller.ts";
import { AnimationLayer, type WorldPose } from "../core.ts";
import type { DollHitState } from "../doll-hit/state.ts";
import type { IntentTarget } from "../intent/controller.ts";
import { RecoveryController } from "../recovery/controller.ts";
import type { Rig } from "../rigs";
import {
  SupportController,
  type SupportSurface,
} from "../support/controller.ts";

/** Everything the game tells an actor each frame. Gameplay state is read-only here. */
export interface ActorInput {
  skillPose?: SkillPose;
  intentTarget?: IntentTarget;
  lockedDirection?: number;
  doll?: Readonly<DollHitState>;
  dollFloor?: number;
  attackSegment?: 1 | 2;
  combatPhase?: "anticipation" | "release" | "recovery";
  hitDirection?: number;
  x: number;
  y: number;
  clock: number;
  instance?: string | number;
  support?: SupportSurface;
  landingSpeed?: number;
  facing: number;
  action: Action;
  age: number;
  vx: number;
  vy?: number;
  grounded: boolean;
  reduced?: boolean;
  visible?: boolean;
  /** Grounded attacks keep the locomotion lower body. */
  moving?: boolean;
}
export interface Point {
  x: number;
  y: number;
}
export interface Mote {
  x: number;
  y: number;
  time: number;
  kind: string;
}

/** The state every pipeline stage shares: the rig, its solved pose in
 *  actor-local space (facing +X), and the frame-to-frame bookkeeping. */
export class ActorState {
  readonly layers: {
    locomotion: AnimationLayer;
    combat: AnimationLayer;
    reaction: AnimationLayer;
  };
  /** Bones that lean with the chest: the torso and all of its descendants. */
  readonly chestBones: string[] = ["torso"];
  /** Sprites in draw order; created once by the view, written by the solvers. */
  readonly parts = new Map<string, CanvasPart>();
  readonly contact = new ContactController();
  readonly support = new SupportController();
  readonly recovery = new RecoveryController();
  readonly contacts = this.support.contacts;
  readonly hand: Point = { x: 0, y: 0 };
  readonly pelvisOffset: Point = { x: 0, y: 0 };
  world: WorldPose = {};
  feet: Point[] = [];
  knees: Point[] = [];
  hips: Point[] = [];
  motes: Mote[] = [];
  last: ActorInput | null = null;
  gait = 0;
  airWeight = 0;
  armError = 0;
  turnAt = -999;
  startAt = -999;
  landAt = -999;
  landImpact = 0;
  lastCombat: Action | undefined;
  combatInstance: string | number | undefined;
  lastReaction: Action = "hurt";
  supportEnabled = true;
  followEnabled = true;
  contactEnabled = true;
  recoveryEnabled = true;
  constructor(readonly rig: Rig) {
    for (const bone of rig.bones)
      if (bone.parent && this.chestBones.includes(bone.parent))
        this.chestBones.push(bone.name);
    this.layers = {
      locomotion: new AnimationLayer("locomotion", rig.bones),
      combat: new AnimationLayer("combat", rig.bones),
      reaction: new AnimationLayer("reaction", rig.bones),
    };
  }
  /** Actor-local point to scene coordinates, using the last drawn frame. */
  toWorld(p: Point): Point {
    const a = this.last!;
    return { x: a.x + p.x * a.facing, y: a.y + p.y };
  }
  reset() {
    this.contact.reset();
    this.support.reset();
    this.recovery.reset();
    Object.values(this.layers).forEach((layer) => layer.reset());
    this.hand.x = this.hand.y = 0;
    this.pelvisOffset.x = this.pelvisOffset.y = 0;
    this.world = {};
    this.feet = [];
    this.knees = [];
    this.hips = [];
    this.motes = [];
    this.last = null;
    this.gait = this.airWeight = this.armError = 0;
    this.turnAt = this.startAt = this.landAt = -999;
    this.landImpact = 0;
    this.lastCombat = undefined;
    this.combatInstance = undefined;
  }
}
