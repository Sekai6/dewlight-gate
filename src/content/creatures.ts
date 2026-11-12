/** How each kind of creature senses, moves and fights. Distances in pixels,
 *  times in seconds, speeds in pixels per second. */
export interface CreatureTuning {
  /** Hovers instead of walking. */
  flying: boolean;
  /** Hover height above its floor, the bob around it, and the altitude step
   *  between moths that share a fight. */
  hover: number;
  bob: number;
  stack: number;
  /** Notices the player inside this box around its floor. */
  sight: number;
  sightHeight: number;
  /** Keeps looking this long after losing sight. */
  memory: number;
  /** Never strays further than this from where it lives. */
  leash: number;
  /** The pause between noticing and acting. */
  alert: number;
  walk: number;
  chase: number;
  retreat: number;
  /** The distance it likes to keep while fighting: nearest and farthest. */
  band: readonly [number, number];
  /** May start an attack inside this box. */
  strikeRange: number;
  strikeHeight: number;
  /** The telegraph. Never shorter than the attack it announces deserves. */
  windup: number;
  strikeSpeed: number;
  strikeTime: number;
  /** A moth dips this far during its dive. */
  dive: number;
  recover: number;
  cooldown: number;
  /** Waits this long for an opening before attacking a busy player anyway;
   *  the factor applies on its last hit point. */
  patience: number;
  lowPatience: number;
  /** Cooldown factor on its last hit point. */
  lowCooldown: number;
  /** Seconds to react to a wound-up skill, the odds of reacting at all, and
   *  how close the skill must be. */
  reaction: number;
  dodge: number;
  dodgeRange: number;
  /** Backs off this long after a companion falls. */
  scare: number;
  /** Launch speed when tossed by a rising hit. */
  liftSpeed: number;
  /** A backward hop out of pressure. Not invulnerable. */
  hop?: { speed: number; time: number; height: number; cooldown: number };
  /** A harmless flight over the player to the other side. */
  pass?: {
    speed: number;
    time: number;
    rise: number;
    offset: number;
    cooldown: number;
  };
}
export const CREATURES: Record<"moss" | "moth", CreatureTuning> = {
  /** Ground brawler: closes in steadily and holds one body length away. */
  moss: {
    flying: false,
    hover: 0,
    bob: 0,
    stack: 0,
    sight: 340,
    sightHeight: 130,
    memory: 2.6,
    leash: 280,
    alert: 0.35,
    walk: 24,
    chase: 58,
    retreat: 44,
    band: [74, 116],
    strikeRange: 132,
    strikeHeight: 87,
    windup: 0.7,
    strikeSpeed: 290,
    strikeTime: 0.22,
    dive: 0,
    recover: 0.45,
    cooldown: 2,
    patience: 1.1,
    lowPatience: 1.8,
    lowCooldown: 1,
    reaction: 0.22,
    dodge: 0.55,
    dodgeRange: 190,
    scare: 0.7,
    liftSpeed: 340,
    hop: { speed: 230, time: 0.42, height: 26, cooldown: 3.2 },
  },
  /** Skirmisher: circles at a distance, dives, and climbs away. */
  moth: {
    flying: true,
    hover: 44,
    bob: 9,
    stack: 16,
    sight: 380,
    sightHeight: 190,
    memory: 3,
    leash: 320,
    alert: 0.3,
    walk: 32,
    chase: 78,
    retreat: 70,
    band: [112, 146],
    strikeRange: 150,
    strikeHeight: 87,
    windup: 0.85,
    strikeSpeed: 340,
    strikeTime: 0.22,
    dive: 13,
    recover: 0.45,
    cooldown: 2,
    patience: 0.9,
    lowPatience: 0.6,
    lowCooldown: 0.6,
    reaction: 0.18,
    dodge: 0.6,
    dodgeRange: 210,
    scare: 0.6,
    liftSpeed: 170,
    pass: { speed: 250, time: 0.9, rise: 34, offset: 130, cooldown: 5 },
  },
};
