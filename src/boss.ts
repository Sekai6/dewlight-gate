// The first guardian is a short duel: read the crown, dodge, punish recovery.
// All deadlines use game time, so menus and browser blur freeze the encounter.
import type { HitContext } from "./action-a/doll-hit/state";
import { DIFFICULTIES } from "./action-skill/config.ts";
import type { Difficulty } from "./action-skill/types";
export type BossPhase =
  | "sleep"
  | "intro"
  | "stalk"
  | "warn"
  | "charge"
  | "slam-warn"
  | "slam"
  | "crystal-warn"
  | "crystal"
  | "garden-warn"
  | "garden"
  | "radiance-warn"
  | "radiance"
  | "combo-gap"
  | "recover"
  | "bound"
  | "defeated";
export interface DewGuardian {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  difficulty: Difficulty;
  hazards: GuardianHazard[];
  nextCombo?: "crystal" | "garden" | "radiance";
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
export interface GuardianHazard {
  id: string;
  kind: "crystal" | "garden" | "radiance";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  at: number;
  end: number;
  hit: boolean;
}
export const GUARDIAN = { left: 2380, right: 3160, x: 2940, y: 1100, hp: 48 };
export function createGuardian(
  defeated = false,
  difficulty: Difficulty = "normal",
): DewGuardian {
  return {
    x: GUARDIAN.x,
    y: GUARDIAN.y,
    hp: defeated ? 0 : DIFFICULTIES[difficulty].hp,
    maxHp: DIFFICULTIES[difficulty].hp,
    difficulty,
    hazards: [],
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
  b.hazards.length = 0;
  b.nextCombo = undefined;
  return true;
}
export function hitGuardian(
  b: DewGuardian,
  now: number,
  skill = false,
): boolean {
  if (
    ["sleep", "intro", "defeated"].includes(b.phase) ||
    (!skill && now < b.hurtUntil)
  )
    return false;
  b.lastDamage =
    !skill && (b.phase === "recover" || b.phase === "bound") ? 2 : 1;
  b.hp = Math.max(0, b.hp - b.lastDamage);
  b.hurtUntil = now + 0.25;
  if (!b.hp) {
    b.phase = "defeated";
    b.until = now;
    b.phaseAt = now;
    b.wave = [];
    b.hazards.length = 0;
    b.nextCombo = undefined;
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
  const profile = DIFFICULTIES[b.difficulty];
  const recover = () => {
    if (b.nextCombo) change("combo-gap", profile.comboGap);
    else change("recover", profile.recovery);
  };
  const prepare = (kind: "crystal" | "garden" | "radiance") => {
    b.facing = player.x < b.x ? -1 : 1;
    const warning = Math.max(
      0.8,
      { crystal: 1, garden: 1.1, radiance: 1.25 }[kind] * profile.warningScale,
    );
    change(`${kind}-warn`, warning);
    const at = now + warning;
    const id = `guardian:${kind}:${now}`;
    // Fixed targets from this instant. Telegraph geometry is the hit geometry.
    if (kind === "crystal") {
      for (let i = -1; i <= 1; i++)
        b.hazards.push({
          id: `${id}:${i}`,
          kind,
          x: b.x,
          y: b.y - 55,
          vx: b.facing * 330 * Math.cos(i * 0.4),
          vy: 330 * Math.sin(i * 0.4),
          radius: 12,
          at,
          end: at + 2.2,
          hit: false,
        });
    } else if (kind === "garden") {
      // Fixed 70px zones separated by 170px gaps, never covering the entire floor.
      const center = Math.max(
        GUARDIAN.left + 240,
        Math.min(GUARDIAN.right - 240, player.x),
      );
      for (let i = -1; i <= 1; i++)
        b.hazards.push({
          id: `${id}:${i}`,
          kind,
          x: center + i * 240,
          y: b.y,
          vx: 0,
          vy: 0,
          radius: 35,
          at: at + (i + 1) * 0.18,
          end: at + (i + 1) * 0.18 + 0.25,
          hit: false,
        });
    } else
      b.hazards.push({
        id,
        kind,
        x: Math.max(
          GUARDIAN.left + 45,
          Math.min(GUARDIAN.right - 45, player.x),
        ),
        y: b.y,
        vx: 0,
        vy: 0,
        radius: 45,
        at,
        end: at + 0.32,
        hit: false,
      });
  };
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
  for (const h of b.hazards) {
    const beforeX = h.x,
      beforeY = h.y;
    if (now >= h.at && now <= h.end) {
      const activeDt = Math.min(dt, Math.max(0, now - h.at));
      h.x += h.vx * activeDt;
      h.y += h.vy * activeDt;
      const px = player.x,
        py = player.y - 24;
      const dx = h.x - beforeX,
        dy = h.y - beforeY;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((px - beforeX) * dx + (py - beforeY) * dy) /
            (dx * dx + dy * dy || 1),
        ),
      );
      const contact =
        h.kind === "crystal"
          ? Math.hypot(px - beforeX - dx * t, py - beforeY - dy * t) <
            h.radius + 20
          : Math.abs(px - h.x) < h.radius + 12 &&
            (h.kind === "radiance"
              ? player.y > b.y - 380
              : player.y > b.y - 90);
      if (!h.hit && contact) {
        h.hit = true;
        damage = true;
        impact = {
          kind: h.kind === "crystal" ? "flying" : "wave",
          sourceX: h.x,
          sourceY: h.y,
          direction: h.vx ? Math.sign(h.vx) : player.x < h.x ? -1 : 1,
          instance: h.id,
        };
      }
    }
  }
  b.hazards = b.hazards.filter((h) => h.end >= now);
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
    if (Math.abs(b.x - b.chargeEnd) < 1) recover();
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
      const pattern =
        b.hp <= b.maxHp / 2
          ? ["charge", "garden", "slam", "radiance", "crystal"]
          : ["charge", "slam", "crystal", "garden"];
      const next = pattern[b.attacks % pattern.length];
      if (["crystal", "garden", "radiance"].includes(next)) {
        if (b.difficulty === "challenge" && b.hp <= b.maxHp / 2)
          b.nextCombo = next === "garden" ? "crystal" : "garden";
        prepare(next as "crystal" | "garden" | "radiance");
      } else if (next === "slam")
        change("slam-warn", Math.max(0.8, 1.05 * profile.warningScale));
      else {
        b.chargeEnd = Math.max(
          GUARDIAN.left + 55,
          Math.min(GUARDIAN.right - 55, player.x + b.facing * 95),
        );
        change("warn", Math.max(0.8, 0.95 * profile.warningScale));
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
      recover();
    } else if (b.phase === "combo-gap") {
      const next = b.nextCombo!;
      b.nextCombo = undefined;
      prepare(next);
    } else if (b.phase.endsWith("-warn")) {
      change(
        b.phase.replace("-warn", "") as BossPhase,
        b.phase === "garden-warn"
          ? 0.65
          : b.phase === "crystal-warn"
            ? 2.2
            : 0.4,
      );
      b.attacks++;
    } else if (["crystal", "garden", "radiance"].includes(b.phase)) {
      recover();
    }
  }
  return { damage, started, impact };
}
