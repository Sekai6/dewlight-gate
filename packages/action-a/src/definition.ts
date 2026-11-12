import type { BoneMask, Bone, Channel, Clip, Pose, Track } from "./core.ts";
import { clamp, sampleTrack } from "./core.ts";
import type { SupportProfile } from "./balance.ts";
import type { ActorInput, ActorState, Point } from "./stages/state.ts";

/** What the engine needs to know about one action. Actions are plain strings;
 *  an action without an entry is ordinary locomotion. */
export interface ActionTraits {
  /** Played on the combat or the reaction layer instead of locomotion. */
  layer?: "combat" | "reaction";
  /** A reaction that adds to the pose instead of replacing it. */
  blend?: "additive";
  /** Short locomotion clip chosen by the driver rather than from velocity. */
  transition?: boolean;
  /** Grounded and moving, it keeps the locomotion lower body. */
  upperBody?: boolean;
  /** The root carries the body; feet neither plant nor step. */
  unplanted?: boolean;
  /** Travel does not advance the gait cycle. */
  gaitFrozen?: boolean;
  /** No stepping even while the root moves. */
  stepBlocked?: boolean;
  /** Foot targets rotate with the root (a body falling over). */
  feetFollowRoot?: boolean;
  /** Each new instance fires one body impulse of this sign; "hit" pushes
   *  away from `hitDirection`. */
  impulse?: number | "hit";
  /** Cuts the post-hit recovery fade short. */
  recoveryCancel?: boolean;
  /** One instance keeps the action it started with. */
  latched?: boolean;
  /** The pose mirrors toward `hitDirection`. */
  mirrorsHit?: boolean;
  /** Leaves afterimages, when the actor has them. */
  echo?: boolean;
  /** Seconds at which release and recovery begin, for three-phase actions. */
  phases?: readonly [number, number];
  /** Fixed diagnostic stage label. */
  stage?: string;
}
const NO_TRAITS: ActionTraits = Object.freeze(Object.create(null));
export function traitsOf(rig: RigDefinition, action: string): ActionTraits {
  return rig.actions[action] ?? NO_TRAITS;
}
/** Coarse stage label for diagnostics. */
export function stageOf(rig: RigDefinition, action: string, age: number) {
  const t = traitsOf(rig, action);
  return t.stage ?? (t.phases ? phaseOf(t.phases, age) : action);
}
export function phaseOf(phases: readonly [number, number], age: number) {
  return age < phases[0]
    ? "anticipation"
    : age < phases[1]
      ? "release"
      : "recovery";
}

/** An authored weapon-hand path for one combat action. */
export interface CombatMotionDefinition {
  duration: number;
  /** Clip-time window in which the blade leaves a trail. */
  trail: readonly [number, number];
  gripX: Track;
  gripY: Track;
  blade: Track;
  contact: number;
  airborne: { gripX: number; gripY: number; counter: number };
}
export type WeightedMask = Record<
  string,
  number | Partial<Record<Channel, number>>
>;
/** Weapon-hand combat for rigs that hold a weapon. */
export interface CombatDefinition {
  motion(action: string): CombatMotionDefinition | undefined;
  /** Per-bone combat layer weights at `age` into `action`. */
  mask(
    age: number,
    moving: boolean,
    out: WeightedMask,
    action: string | undefined,
  ): BoneMask;
}
/** A gameplay move (skill) mirrored onto the body. */
export interface MovePose {
  instance: number;
  id: string;
  phase: string;
  age: number;
}
export function sampleWeapon(
  motion: CombatMotionDefinition,
  age: number,
  out: { x: number; y: number; rotation: number },
  airWeight = 0,
) {
  out.x = sampleTrack(motion.gripX, age);
  out.y = sampleTrack(motion.gripY, age);
  out.rotation = sampleTrack(motion.blade, age);
  const envelope = Math.sin(clamp(age / motion.duration) * Math.PI) * airWeight;
  out.x += motion.airborne.gripX * envelope;
  out.y += motion.airborne.gripY * envelope;
  return out;
}

/** Bone names of one two-bone arm: shoulder to elbow to hand, plus the two
 *  joint sprites that follow it. */
export interface ArmChain {
  upper: string;
  lower: string;
  end: string;
  shoulder: string;
  elbow: string;
}
/** Which bones play which role. The engine never names a bone itself. */
export interface RigSlots {
  root: string;
  hip: string;
  chest: string;
  head: string;
  /** The weapon arm and the free arm. */
  front: ArmChain;
  back: ArmChain;
  /** Springs after the chest: cloth, a head ornament, something carried. */
  sway?: string;
  ornament?: string;
  dangle?: string;
  /** Bones a moving upper-body attack takes over. */
  upperBody: ReadonlySet<string>;
  /** Ragdoll: the mass that rests on the ground, and cloth that drapes. */
  core: ReadonlySet<string>;
  soft: ReadonlySet<string>;
}
/** Behaviour supplied alongside the rig data. */
export interface RigDefinition {
  /** Traits per action name. */
  actions: Readonly<Record<string, ActionTraits>>;
  /** The authored clip for an action. Called every frame: cache it. */
  clip(action: string): Clip;
  combat?: CombatDefinition;
  /** Procedural motion layered on the composed pose: wingbeat, sway, the
   *  airborne counter-pose of an attack. */
  bodyMotion?(pose: Pose, input: ActorInput, state: ActorState): void;
  /** Extra airborne foot offset while a move plays. */
  footOffset?(move: MovePose, side: number, weight: number, out: Point): void;
}
export interface RigDefinition {
  support: SupportProfile;
  bob: number;
  sway: number;
  lean: number;
  knees: [number, number];
  /** Free-form label for the character this rig describes. */
  kind: string;
  bones: Bone[];
  leg: number;
  footSpan: number;
  stride: number;
  stance: number;
  slots: RigSlots;
  /** Grip to tip along the weapon bone, in rig units. */
  bladeLength: number;
  /** Rigid arm segment lengths, read from the bone rest offsets. */
  arms: { front: ArmLengths; back: ArmLengths };
  /** Leg sprites: segment width, joint diameters and the foot. */
  legSkin: {
    width: number;
    /** Shin width at rest; a solved leg draws both segments at `width`. */
    shin: number;
    knee: number;
    ankle: number;
    footWidth: number;
    footHeight: number;
  };
  /** Half-size of the square that always contains the drawn rig. */
  extent: number;
  /** Never touches the ground: always airborne, wing-driven body motion. */
  flying: boolean;
  /** Has a weapon arm: grip IK, sword trail, masked combat, get-up recovery. */
  armed: boolean;
  doll: DollTuning;
  motion: {
    /** Use the driver's velocity as is; otherwise derive it from displacement. */
    trustVelocity: boolean;
    /** Speed at which the procedural gait reaches full amplitude. */
    runSpeed: number;
    /** Speed and amplitude of the unarmed walkers' hip sway. */
    swaySpeed: number;
    swayAmount: number;
    landDip: number;
    capeRate: number;
    ornamentRate: number;
    shadowWidth: number;
    impulseGain: number;
    /** Seconds: airborne attack counter-pose, start push, landing squash. */
    combatEnvelope: number;
    startPush: number;
    landSquash: number;
    /** Head and chest attention limits in degrees. */
    attention: readonly [number, number];
  };
  skin: {
    bone: string;
    texture: string;
    width: number;
    height: number;
    originY?: number;
    depth?: number;
  }[];
}
/** How the body behaves as a hit ragdoll. */
export interface DollTuning {
  /** Spring pulling each hand and foot back to its posed place. */
  stiffness: number;
  damping: number;
  /** Extra downward pull on the loose end points. */
  gravity: number;
  /** Radians a limb may swing away from its posed direction. */
  cone: number;
  /** Head counter-rotation per rad/s of spin, and its limit in radians. */
  headLag: number;
  headLimit: number;
  /** Chest lag per rad/s of spin, its limit, the airborne curl, and the
   *  fold kicked in by an impact. */
  spine: number;
  spineLimit: number;
  curl: number;
  jolt: number;
}
export interface ArmLengths {
  upper: number;
  lower: number;
}
export type Rig = RigDefinition;
