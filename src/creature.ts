export type CreaturePhase = "patrol" | "windup" | "strike" | "recover";
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
  if (e.hp <= 0) e.diedAt = time;
}

/** Simulated time only: menus, blur and hidden tabs freeze every attack stage. */
export function stepCreature(
  e: Enemy,
  time: number,
  dt: number,
  player: { x: number; y: number },
) {
  if (e.hp <= 0) return false;
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
