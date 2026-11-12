import { DollHitController } from "@dewlight/action-a";
import { HIT_PROFILES, type HitKind } from "./content/hits.ts";

export type CreaturePhase = "patrol" | "windup" | "strike" | "recover";
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
  minX: number;
  maxX: number;
  gait: number;
  liftVy?: number;
  liftOffset?: number;
  /** How far a knocked-out body may travel on its platform. */
  edgeMin?: number;
  edgeMax?: number;
  corpse?: Corpse;
}

export function liftCreature(e: Enemy) {
  if (e.corpse) {
    // A finishing launcher sends the body up instead of away.
    e.corpse.vy = -520;
    e.corpse.vx *= 0.35;
  }
  if (e.hp <= 0) return;
  e.liftVy = e.type ? -170 : -340;
  e.liftOffset = Math.min(0, e.liftOffset ?? 0);
  e.phase = "recover";
  e.warn = 0;
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export function hurtCreature(e: Enemy, time: number, direction: number) {
  if (e.hp <= 0) return;
  e.hp--;
  e.hurtAt = time;
  e.hitDirection = direction;
  e.phase = "recover";
  e.phaseAt = time;
  e.warn = 0;
  e.cool = time + 0.65;
  e.x = clamp(e.x + direction * 12, e.minX, e.maxX);
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
      vx: doll.state.direction * doll.profile.horizontal,
      vy: -doll.profile.upward,
      x: e.x,
      y: e.y,
    };
  }
}

const GRAVITY = 1350;
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

/** Simulated time only: menus, blur and hidden tabs freeze every attack stage. */
export function stepCreature(
  e: Enemy,
  time: number,
  dt: number,
  player: { x: number; y: number },
) {
  if (e.hp <= 0) {
    if (e.corpse) stepCorpse(e, time, dt);
    return false;
  }
  if (e.liftVy !== undefined) {
    e.liftVy += 1000 * dt;
    e.liftOffset = (e.liftOffset ?? 0) + e.liftVy * dt;
    e.y = e.floor - (e.type ? 44 : 0) + e.liftOffset;
    e.phase = "recover";
    e.phaseAt = time;
    e.warn = 0;
    e.cool = time + 0.65;
    if (e.liftOffset >= 0 && e.liftVy > 0) {
      e.liftVy = undefined;
      e.liftOffset = 0;
      e.y = e.floor - (e.type ? 44 : 0);
    }
    return false;
  }
  if (e.bound > time) {
    // Binding cancels the telegraph. Release cannot cause an unannounced strike.
    e.phase = "patrol";
    e.phaseAt = time;
    e.warn = 0;
    e.cool = Math.max(e.cool, time + 0.3);
    return false;
  }
  const dx = player.x - e.x,
    dy = player.y - e.y;
  let hit = false;
  const before = e.x;
  if (e.phase === "windup") {
    e.warn = Math.max(0, (e.type ? 0.85 : 0.7) - (time - e.phaseAt));
    if (e.warn <= 0) {
      e.phase = "strike";
      e.phaseAt = time;
      e.attackHit = false;
    }
  } else if (e.phase === "strike") {
    e.x = clamp(e.x + e.attackDir * (e.type ? 340 : 290) * dt, e.minX, e.maxX);
    if (!e.attackHit && Math.abs(player.x - e.x) < 47 && Math.abs(dy) < 67) {
      hit = true;
      e.attackHit = true;
    }
    if (time - e.phaseAt >= 0.22) {
      e.phase = "recover";
      e.phaseAt = time;
      e.cool = time + 1.25;
    }
  } else if (e.phase === "recover") {
    if (time - e.phaseAt >= 0.45) {
      e.phase = "patrol";
      e.phaseAt = time;
    }
  } else if (
    Math.abs(dx) < (e.type ? 150 : 132) &&
    Math.abs(dy) < 87 &&
    time > e.cool
  ) {
    e.attackDir = dx < 0 ? -1 : 1;
    e.dir = e.attackDir;
    e.phase = "windup";
    e.phaseAt = time;
    e.warn = e.type ? 0.85 : 0.7;
  } else {
    e.x = clamp(e.x + e.dir * (e.type ? 32 : 24) * dt, e.minX, e.maxX);
    if (e.x >= e.maxX || e.x <= e.minX) e.dir *= -1;
  }
  e.gait += Math.abs(e.x - before) / 40;
  const float = e.type ? 44 + Math.sin(time * 2 + e.home) * 9 : 0;
  // The moth's dive stays within the same readable vertical attack band.
  e.y =
    e.floor -
    float +
    (e.type && e.phase === "strike"
      ? Math.sin(Math.min(1, (time - e.phaseAt) / 0.22) * Math.PI) * 13
      : 0);
  return hit;
}
