// The first guardian is a short duel: read the crown, dodge, punish recovery.
// All deadlines use game time, so menus and browser blur freeze the encounter.
import type { HitContext } from "./action-a/doll-hit/state";
export type BossPhase =
  | "sleep"
  | "intro"
  | "stalk"
  | "warn"
  | "charge"
  | "slam-warn"
  | "slam"
  | "recover"
  | "bound"
  | "defeated";
export interface DewGuardian {
  x: number;
  y: number;
  hp: number;
  phase: BossPhase;
  until: number;
  facing: number;
  attacks: number;
  struck: boolean;
  hurtUntil: number;
  boundUntil: number;
  bindReadyAt: number;
  phaseAt: number;
  chargeEnd: number;
  wave: { x: number; dir: number; hit: boolean }[];
  lastDamage: number;
}
export const GUARDIAN = { left: 2380, right: 3160, x: 2940, y: 1100, hp: 36 };
export function createGuardian(defeated = false): DewGuardian {
  return {
    x: GUARDIAN.x,
    y: GUARDIAN.y,
    hp: defeated ? 0 : GUARDIAN.hp,
    phase: defeated ? "defeated" : "sleep",
    until: 0,
    facing: -1,
    attacks: 0,
    struck: false,
    hurtUntil: -1,
    boundUntil: -1,
    bindReadyAt: -1,
    phaseAt: 0,
    chargeEnd: GUARDIAN.x,
    wave: [],
    lastDamage: 0,
  };
}
export function bindGuardian(b: DewGuardian, now: number): boolean {
  if (now < b.bindReadyAt) return false;
  if (["sleep", "intro", "defeated", "bound"].includes(b.phase)) return false;
  b.phase = "bound";
  b.boundUntil = now + 2.1;
  b.bindReadyAt = now + 5.5;
  b.until = b.boundUntil;
  b.phaseAt = now;
  b.wave = [];
  return true;
}
export function hitGuardian(b: DewGuardian, now: number): boolean {
  if (["sleep", "intro", "defeated"].includes(b.phase) || now < b.hurtUntil)
    return false;
  b.lastDamage = b.phase === "recover" || b.phase === "bound" ? 2 : 1;
  b.hp = Math.max(0, b.hp - b.lastDamage);
  b.hurtUntil = now + 0.25;
  if (!b.hp) {
    b.phase = "defeated";
    b.until = now;
    b.phaseAt = now;
    b.wave = [];
  }
  return true;
}
export function stepGuardian(
  b: DewGuardian,
  now: number,
  dt: number,
  player: { x: number; y: number },
): { damage: boolean; started: boolean; impact?: HitContext } {
  const change = (phase: BossPhase, duration: number) => {
    b.phase = phase;
    b.phaseAt = now;
    b.until = now + duration;
  };
  let damage = false,
    started = false;
  let impact: HitContext | undefined;
  if (b.phase === "defeated") return { damage, started };
  if (b.phase === "sleep") {
    if (
      player.x > GUARDIAN.left + 40 &&
      player.x <= GUARDIAN.right &&
      Math.abs(player.y - b.y) < 100
    ) {
      change("intro", 1.1);
      started = true;
    }
    return { damage, started };
  }
  for (const wave of b.wave) {
    const before = wave.x;
    wave.x += wave.dir * 300 * dt;
    if (
      !wave.hit &&
      player.x >= Math.min(before, wave.x) - 22 &&
      player.x <= Math.max(before, wave.x) + 22 &&
      Math.abs(player.y - b.y) < 32
    ) {
      wave.hit = true;
      damage = true;
      impact = {
        kind: "wave",
        sourceX: wave.x,
        sourceY: b.y,
        direction: wave.dir,
        instance: `guardian:wave:${b.phaseAt}:${wave.dir}`,
      };
    }
  }
  b.wave = b.wave.filter(
    (w) => w.x > GUARDIAN.left - 100 && w.x < GUARDIAN.right + 100,
  );
  if (b.phase === "charge") {
    const before = b.x;
    b.x += b.facing * Math.min(Math.abs(b.chargeEnd - b.x), 460 * dt);
    if (
      !b.struck &&
      player.x >= Math.min(before, b.x) - 48 &&
      player.x <= Math.max(before, b.x) + 48 &&
      Math.abs(player.y - b.y) < 48
    ) {
      b.struck = true;
      damage = true;
      impact = {
        kind: "charge",
        sourceX: b.x,
        sourceY: b.y,
        direction: b.facing,
        instance: `guardian:charge:${b.phaseAt}`,
      };
    }
    if (Math.abs(b.x - b.chargeEnd) < 1) change("recover", 2.0);
  }
  if (b.phase === "stalk") {
    b.facing = player.x < b.x ? -1 : 1;
    if (Math.abs(player.x - b.x) > 130) b.x += b.facing * 65 * dt;
    b.x = Math.max(GUARDIAN.left + 45, Math.min(GUARDIAN.right - 45, b.x));
  }
  if (now >= b.until) {
    if (["intro", "recover", "bound"].includes(b.phase)) {
      change("stalk", 0.85);
    } else if (b.phase === "stalk") {
      b.facing = player.x < b.x ? -1 : 1;
      if (b.attacks % 2 === 1) change("slam-warn", 1.05);
      else {
        b.chargeEnd = Math.max(
          GUARDIAN.left + 55,
          Math.min(GUARDIAN.right - 55, player.x + b.facing * 95),
        );
        change("warn", 0.95);
      }
    } else if (b.phase === "warn") {
      change("charge", 1.15);
      b.struck = false;
      b.attacks++;
    } else if (b.phase === "slam-warn") {
      change("slam", 0.22);
      b.attacks++;
      b.wave = [
        { x: b.x, dir: -1, hit: false },
        { x: b.x, dir: 1, hit: false },
      ];
    } else if (b.phase === "charge" || b.phase === "slam") {
      change("recover", 2.0);
    }
  }
  return { damage, started, impact };
}
