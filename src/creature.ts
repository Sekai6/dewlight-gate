import { DollHitController } from "@dewlight/action-a";
import { CREATURES, type CreatureTuning } from "./content/creatures.ts";
import { HIT_PROFILES, type HitKind } from "./content/hits.ts";

/** patrol: unaware, pacing at home. alert: just noticed the player.
 *  engage: fighting for position. windup, strike, recover: one attack.
 *  hop, pass: harmless repositioning. return: walking home. */
export type CreaturePhase =
  | "patrol"
  | "alert"
  | "engage"
  | "windup"
  | "strike"
  | "recover"
  | "hop"
  | "pass"
  | "return";
/** What a creature can know about the player. */
export interface PlayerView {
  x: number;
  y: number;
  hp?: number;
  /** A sword swing or skill is winding up or hitting right now. */
  attacking?: boolean;
  /** Instance of the skill being wound up, while it can still be read. */
  casting?: number;
}
/** A defeated creature's body, knocked away and left to settle. Visual only. */
export interface Corpse {
  doll: DollHitController<HitKind>;
  vx: number;
  vy: number;
  /** Where it was defeated; reduced motion keeps the body there. */
  x: number;
  y: number;
  /** Time the body came to rest; it fades from then on. */
  restAt?: number;
}
export interface Enemy {
  x: number;
  y: number;
  home: number;
  floor: number;
  type: number;
  hp: number;
  dir: number;
  bound: number;
  warn: number;
  cool: number;
  id: string;
  guard?: string;
  phase: CreaturePhase;
  phaseAt: number;
  hurtAt: number;
  hitDirection?: number;
  diedAt: number;
  attackDir: number;
  attackHit: boolean;
  /** The stretch it paces while unaware. */
  minX: number;
  maxX: number;
  gait: number;
  liftVy?: number;
  liftOffset?: number;
  /** How far a knocked-out body may travel on its platform. */
  edgeMin?: number;
  edgeMax?: number;
  corpse?: Corpse;
  /** Remaining knock-back speed. */
  shove?: number;
  /** When it last saw the player. */
  seenAt?: number;
  /** Since when the player has been inside its strike box. */
  inRangeAt?: number;
  /** Squad coordination: holds an attack slot / may begin its telegraph this
   *  frame. Undefined while nobody coordinates it. */
  token?: boolean;
  go?: boolean;
  /** Altitude slot among moths sharing a fight. */
  slot?: number;
  /** The last skill wind-up it noticed, and when it will act on it. */
  sawCast?: number;
  dodgeAt?: number;
  /** A companion just fell nearby. */
  scareAt?: number;
  mourned?: boolean;
  hopAt?: number;
  hopDir?: number;
  passAt?: number;
  passTo?: number;
}

export function creatureTuning(e: { type: number }): CreatureTuning {
  return e.type ? CREATURES.moth : CREATURES.moss;
}
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
/** Where the creature may go while fighting: its platform, within its leash. */
function roamMin(e: Enemy, t: CreatureTuning) {
  return Math.max(e.home - t.leash, (e.edgeMin ?? e.minX - 16) + 16);
}
function roamMax(e: Enemy, t: CreatureTuning) {
  return Math.min(e.home + t.leash, (e.edgeMax ?? e.maxX + 16) - 16);
}
/** Repeatable 0..1 roll for one creature and one occasion. */
function roll(e: Enemy, occasion: number) {
  const v = Math.sin(e.home * 12.9898 + occasion * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

export function liftCreature(e: Enemy) {
  if (e.corpse) {
    // A finishing launcher sends the body up instead of away.
    e.corpse.vy = -520;
    e.corpse.vx *= 0.35;
  }
  if (e.hp <= 0) return;
  e.liftVy = -creatureTuning(e).liftSpeed;
  e.liftOffset = Math.min(0, e.liftOffset ?? 0);
  e.phase = "recover";
  e.warn = 0;
  e.token = false;
}

/** `push` is how far the blow shoves the creature, in pixels. */
export function hurtCreature(
  e: Enemy,
  time: number,
  direction: number,
  push = 12,
) {
  if (e.hp <= 0) return;
  const t = creatureTuning(e);
  e.hp--;
  e.hurtAt = time;
  e.hitDirection = direction;
  e.phase = "recover";
  e.phaseAt = time;
  e.warn = 0;
  e.cool = time + 0.65;
  e.token = false;
  // Being hit tells it where the player is.
  e.seenAt = time;
  e.x = clamp(e.x + direction * 12, roamMin(e, t), roamMax(e, t));
  // The rest of a heavy shove plays out over the next moments.
  e.shove = direction * Math.max(0, push - 12) * SHOVE_RATE;
  if (e.hp <= 0) {
    e.diedAt = time;
    e.liftVy = undefined;
    const doll = new DollHitController(HIT_PROFILES);
    doll.start(
      {
        kind: "defeat",
        sourceX: e.x - direction,
        sourceY: e.y,
        direction,
        instance: `${e.id}:defeat`,
      },
      true,
    );
    e.corpse = {
      doll,
      vx:
        doll.state.direction *
        doll.profile.horizontal *
        (1 + Math.max(0, push - 12) / 80),
      vy: -doll.profile.upward,
      x: e.x,
      y: e.y,
    };
  }
}

const GRAVITY = 1350;
/** A shove decays at this rate per second; its travel is speed / rate. */
const SHOVE_RATE = 10;
function stepCorpse(e: Enemy, time: number, dt: number) {
  const c = e.corpse!;
  if (c.restAt !== undefined) return;
  const min = e.edgeMin ?? e.minX,
    max = e.edgeMax ?? e.maxX;
  let remaining = Math.min(dt, 0.25);
  while (remaining > 1e-8) {
    const h = Math.min(1 / 120, remaining);
    remaining -= h;
    const grounded = e.y >= e.floor;
    c.doll.tick(h, grounded, c.vx);
    c.vx = c.doll.drag(c.vx, h, grounded);
    c.vy += GRAVITY * h;
    const x = e.x + c.vx * h;
    e.x = clamp(x, min, max);
    // The platform edge stops the body; it never slides off into the air.
    if (e.x !== x) c.vx = 0;
    e.y += c.vy * h;
    if (e.y >= e.floor && c.vy >= 0) {
      e.y = e.floor;
      c.vy = c.doll.land(c.vy);
    }
  }
  if (
    (c.doll.state.phase === "down" && Math.abs(c.vx) < 8) ||
    time - e.diedAt > 4
  )
    c.restAt = time;
}

/** Seconds between two telegraphs of one squad, so each can be read. */
const WARN_GAP = 0.6;
/** Creatures this close to the player take part in the same fight. */
const FIGHT_RANGE = 460;
const FIGHT_HEIGHT = 220;
/** A falling companion is felt within this distance. */
const SCARE_RANGE = 240;

/** Squad rules, once per step before the creatures act: only a few may
 *  attack at a time, telegraphs never overlap, and the rest keep their
 *  distance. Also spreads the word when one of them falls. */
export function coordinateCreatures(
  enemies: readonly Enemy[],
  time: number,
  player: PlayerView,
) {
  let holders = 0,
    lastWarn = -Infinity,
    moths = 0;
  let waiting: Enemy | undefined,
    waitingScore = Infinity,
    ready: Enemy | undefined,
    readyDistance = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0) {
      if (e.corpse && !e.mourned) {
        e.mourned = true;
        for (const other of enemies)
          if (
            other.hp > 0 &&
            Math.abs(other.x - e.x) < SCARE_RANGE &&
            Math.abs(other.floor - e.floor) < FIGHT_HEIGHT
          )
            other.scareAt = time;
      }
      continue;
    }
    const fighting =
      (e.phase === "alert" ||
        e.phase === "engage" ||
        e.phase === "windup" ||
        e.phase === "strike") &&
      Math.abs(e.x - player.x) < FIGHT_RANGE &&
      Math.abs(e.floor - player.y) < FIGHT_HEIGHT;
    if (!fighting) {
      if (e.phase === "patrol" || e.phase === "return")
        e.token = e.go = undefined;
      continue;
    }
    if (e.type) e.slot = moths++;
    e.go = false;
    if (e.phase === "windup" || e.phase === "strike") {
      holders++;
      const t = creatureTuning(e);
      lastWarn = Math.max(
        lastWarn,
        e.phase === "windup" ? e.phaseAt : e.phaseAt - t.windup,
      );
      continue;
    }
    const distance = Math.abs(e.x - player.x);
    if (e.token) {
      holders++;
      if (e.phase === "engage" && distance < readyDistance) {
        ready = e;
        readyDistance = distance;
      }
      continue;
    }
    e.token = false;
    if (e.phase !== "engage") continue;
    // The nearest goes first; the longer one has waited, the sooner its turn.
    const score = distance - (time - e.phaseAt) * 30;
    if (score < waitingScore) {
      waiting = e;
      waitingScore = score;
    }
  }
  // A player in trouble faces one attacker at a time.
  const slots = (player.hp ?? 5) <= 2 ? 1 : 2;
  if (waiting && holders < slots) {
    waiting.token = true;
    if (Math.abs(waiting.x - player.x) < readyDistance) ready = waiting;
  }
  if (ready && time - lastWarn >= WARN_GAP) ready.go = true;
}

/** One creature's turn. Returns true when its strike connects.
 *  Simulated time only: menus, blur and hidden tabs freeze every stage. */
export function stepCreature(
  e: Enemy,
  time: number,
  dt: number,
  player: PlayerView,
) {
  if (e.hp <= 0) {
    if (e.corpse) stepCorpse(e, time, dt);
    return false;
  }
  const t = creatureTuning(e);
  const lo = roamMin(e, t),
    hi = roamMax(e, t);
  if (e.shove) {
    e.x = clamp(e.x + e.shove * dt, lo, hi);
    e.shove *= Math.exp(-dt * SHOVE_RATE);
    if (Math.abs(e.shove) < 4) e.shove = 0;
  }
  if (e.liftVy !== undefined) {
    e.liftVy += 1000 * dt;
    e.liftOffset = (e.liftOffset ?? 0) + e.liftVy * dt;
    e.y = e.floor - t.hover + e.liftOffset;
    e.phase = "recover";
    e.phaseAt = time;
    e.warn = 0;
    e.cool = time + 0.65;
    if (e.liftOffset >= 0 && e.liftVy > 0) {
      e.liftVy = undefined;
      e.liftOffset = 0;
      e.y = e.floor - t.hover;
    }
    return false;
  }
  if (e.bound > time) {
    // Binding cancels the telegraph. Release cannot cause an unannounced strike.
    e.phase = "engage";
    e.phaseAt = time;
    e.seenAt = time;
    e.warn = 0;
    e.token = false;
    e.cool = Math.max(e.cool, time + 0.3);
    return false;
  }
  const dx = player.x - e.x,
    distance = Math.abs(dx),
    toward = dx < 0 ? -1 : 1;
  const sees =
    distance < t.sight && Math.abs(player.y - e.floor) < t.sightHeight;
  if (sees) e.seenAt = time;
  const aware = time - (e.seenAt ?? -Infinity) < t.memory;
  const low = e.hp <= 1;
  const before = e.x;
  let hit = false;
  const enter = (phase: CreaturePhase) => {
    e.phase = phase;
    e.phaseAt = time;
  };
  const move = (direction: number, speed: number) => {
    e.x = clamp(e.x + direction * speed * dt, lo, hi);
  };
  const age = time - e.phaseAt;
  if (e.phase === "windup") {
    e.warn = Math.max(0, t.windup - age);
    if (e.warn <= 0) {
      enter("strike");
      e.attackHit = false;
    }
  } else if (e.phase === "strike") {
    move(e.attackDir, t.strikeSpeed);
    if (
      !e.attackHit &&
      Math.abs(player.x - e.x) < 47 &&
      Math.abs(player.y - e.y) < 67
    ) {
      hit = true;
      e.attackHit = true;
    }
    if (age >= t.strikeTime) {
      enter("recover");
      e.cool = time + t.cooldown * (low ? t.lowCooldown : 1);
      e.token = false;
    }
  } else if (e.phase === "recover") {
    if (age >= t.recover) enter(aware ? "engage" : "return");
  } else if (e.phase === "alert") {
    e.dir = toward;
    if (age >= t.alert) {
      enter("engage");
      // Sizing the player up: no attack in the first moments.
      e.cool = Math.max(e.cool, time + 0.7);
    }
  } else if (e.phase === "hop") {
    move(e.hopDir ?? -toward, t.hop!.speed);
    if (age >= t.hop!.time) {
      enter("engage");
      e.hopAt = time;
    }
  } else if (e.phase === "pass") {
    const remaining = (e.passTo ?? e.x) - e.x;
    e.dir = remaining < 0 ? -1 : 1;
    move(e.dir, t.pass!.speed);
    if (Math.abs(remaining) < 8 || age >= t.pass!.time) {
      enter("engage");
      e.passAt = time;
      e.dir = player.x < e.x ? -1 : 1;
    }
  } else if (e.phase === "patrol") {
    if (sees) {
      e.dir = toward;
      enter("alert");
    } else {
      e.x = clamp(e.x + e.dir * t.walk * dt, e.minX, e.maxX);
      if (e.x >= e.maxX || e.x <= e.minX) e.dir *= -1;
    }
  } else if (e.phase === "return") {
    const home = e.home - e.x;
    if (sees) enter("engage");
    else if (Math.abs(home) < 4) enter("patrol");
    else {
      e.dir = home < 0 ? -1 : 1;
      move(e.dir, t.walk * 1.4);
    }
  } else if (!aware) {
    enter("return");
  } else {
    // Engaged: face the player and fight for position.
    e.dir = toward;
    const scared = time - (e.scareAt ?? -Infinity) < t.scare;
    const waiting = e.token === false;
    let near = t.band[0],
      far = t.band[1];
    // Wounded walkers grow careful; everyone without a turn hangs back.
    if (low && !t.flying) {
      near += 40;
      far += 40;
    }
    if (waiting) {
      near += 45;
      far += 60;
    }
    // A skill being wound up can be read, after a moment and not every time.
    if (player.casting !== undefined && player.casting !== e.sawCast) {
      e.sawCast = player.casting;
      if (distance < t.dodgeRange && roll(e, player.casting) < t.dodge)
        e.dodgeAt = time + t.reaction;
    }
    if (e.dodgeAt !== undefined && time - e.dodgeAt > 0.4)
      e.dodgeAt = undefined;
    const dodge = e.dodgeAt !== undefined && time >= e.dodgeAt;
    const pressed = time - e.hurtAt < 0.9 && distance < near + 30;
    const away = -toward;
    const room = away < 0 ? e.x - lo : hi - e.x;
    if (
      t.hop &&
      (dodge || pressed) &&
      room > 40 &&
      time - (e.hopAt ?? -Infinity) > t.hop.cooldown
    ) {
      e.dodgeAt = undefined;
      e.hopDir = away;
      enter("hop");
    } else if (
      t.pass &&
      (dodge || (waiting && age > 1.6) || room < 30) &&
      time - (e.passAt ?? -Infinity) > t.pass.cooldown &&
      Math.abs(clamp(player.x + toward * t.pass.offset, lo, hi) - e.x) > 70
    ) {
      e.dodgeAt = undefined;
      e.passTo = clamp(player.x + toward * t.pass.offset, lo, hi);
      enter("pass");
    } else {
      let cornered = false;
      if (scared || dodge || distance < near) {
        move(away, t.retreat);
        // Nowhere left to back into: stand and fight.
        cornered = Math.abs(e.x - before) < 1e-6;
      } else if (distance > far) move(toward, t.chase);
      const inRange =
        distance < t.strikeRange && Math.abs(player.y - e.y) < t.strikeHeight;
      if (!inRange) e.inRangeAt = undefined;
      else e.inRangeAt ??= time;
      const patience = t.patience * (low ? t.lowPatience : 1);
      // Prefer a moment when the player is not mid-swing, but never wait forever.
      const opening =
        !player.attacking ||
        cornered ||
        time - (e.inRangeAt ?? time) > patience;
      if (inRange && opening && !scared && e.go !== false && time > e.cool) {
        e.attackDir = toward;
        enter("windup");
        e.warn = t.windup;
        e.token = true;
      }
    }
  }
  e.gait += Math.abs(e.x - before) / 40;
  const phaseAge = time - e.phaseAt;
  const float = t.flying
    ? t.hover + Math.sin(time * 2 + e.home) * t.bob + (e.slot ?? 0) * t.stack
    : 0;
  // The moth's dive stays within the same readable vertical attack band.
  const dive =
    e.phase === "strike"
      ? Math.sin(Math.min(1, phaseAge / t.strikeTime) * Math.PI) * t.dive
      : 0;
  const rise =
    e.phase === "hop"
      ? Math.sin(Math.min(1, phaseAge / t.hop!.time) * Math.PI) * t.hop!.height
      : e.phase === "pass"
        ? Math.sin(Math.min(1, phaseAge / t.pass!.time) * Math.PI) *
          t.pass!.rise
        : 0;
  e.y = e.floor - float + dive - rise;
  return hit;
}
