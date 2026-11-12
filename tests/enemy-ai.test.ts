import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coordinateCreatures,
  stepCreature,
  type Enemy,
  type PlayerView,
} from "../src/creature.ts";
import { CREATURES } from "../src/content/creatures.ts";
import { chooseMove, createGuardian, type BossMove } from "../src/boss.ts";

const DT = 1 / 60;
const spawn = (x: number, id: string, type = 0): Enemy => ({
  x,
  y: 1100,
  home: x,
  floor: 1100,
  type,
  hp: 2,
  dir: 1,
  bound: 0,
  warn: 0,
  cool: 0,
  id,
  phase: "patrol",
  phaseAt: 0,
  hurtAt: -999,
  diedAt: -999,
  attackDir: 1,
  attackHit: false,
  gait: 0,
  minX: x - 90,
  maxX: x + 90,
  edgeMin: x - 400,
  edgeMax: x + 400,
});
/** Run a fight; `watch` sees every creature after every step. */
function run(
  enemies: Enemy[],
  player: PlayerView,
  seconds: number,
  watch: (time: number) => void,
  from = 0,
) {
  for (let time = from + DT; time < from + seconds; time += DT) {
    coordinateCreatures(enemies, time, player);
    for (const e of enemies) stepCreature(e, time, DT, player);
    watch(time);
  }
}

test("a creature notices, closes in, stays on its leash, and goes home when the player leaves", () => {
  const e = spawn(1000, "a");
  const player = { x: 1320, y: 1100, hp: 5 };
  const seen: string[] = [];
  run([e], player, 6, () => {
    if (seen.at(-1) !== e.phase) seen.push(e.phase);
    assert.ok(e.x <= 1000 + CREATURES.moss.leash + 1e-6);
  });
  assert.deepEqual(seen.slice(0, 2), ["alert", "engage"]);
  assert.ok(e.x > 1150, "it chased");
  player.x = 3000;
  run([e], player, 14, () => {}, 6);
  assert.equal(e.phase, "patrol");
  assert.ok(Math.abs(e.x - 1000) <= 90);
});

test("a squad takes turns: limited attackers, spaced telegraphs, one at a time on a hurt player", () => {
  for (const hp of [5, 2]) {
    const enemies = [spawn(900, "a"), spawn(1100, "b"), spawn(1040, "c", 1)];
    const player = { x: 1000, y: 1100, hp };
    const warnings: number[] = [];
    const previous = new Map<Enemy, string>();
    let most = 0;
    run(enemies, player, 14, (time) => {
      let attacking = 0;
      for (const e of enemies) {
        if (e.phase === "windup" && previous.get(e) !== "windup")
          warnings.push(time);
        if (e.phase === "windup" || e.phase === "strike") attacking++;
        previous.set(e, e.phase);
      }
      most = Math.max(most, attacking);
    });
    assert.ok(warnings.length >= 4, "they do attack");
    assert.ok(most <= (hp <= 2 ? 1 : 2));
    for (let i = 1; i < warnings.length; i++)
      assert.ok(warnings[i] - warnings[i - 1] >= 0.6 - DT - 1e-9);
  }
});

test("a read skill makes a walker hop back, harmlessly and not again before its cooldown", () => {
  const hops: number[] = [];
  // Different creatures roll differently; some of them must react.
  for (let n = 0; n < 12; n++) {
    const e = spawn(1000 + n * 7, `m${n}`);
    const player: PlayerView = { x: e.x + 90, y: 1100, hp: 5, attacking: true };
    let last = "";
    run([e], player, 1.2, () => {});
    player.casting = 1;
    run(
      [e],
      player,
      1,
      (time) => {
        if (e.phase === "hop" && last !== "hop") hops.push(time);
        last = e.phase;
        assert.ok(e.phase !== "strike" || last !== "hop");
      },
      1.2,
    );
    // One that hopped cannot hop again at once, however tempting.
    if (last === "hop" || e.hopAt !== undefined) {
      const count = hops.length;
      player.casting = 2;
      run([e], player, 1, () => assert.notEqual(e.phase, "hop"), 2.2);
      assert.equal(hops.length, count);
    }
  }
  assert.ok(hops.length >= 3 && hops.length < 12);
});

test("the guardian never repeats a move, saves radiance for the second half, and answers the situation", () => {
  const tally = (setup: (b: ReturnType<typeof createGuardian>) => void) => {
    return (player: { x: number; y: number; onGround?: boolean }) => {
      const count: Partial<Record<BossMove, number>> = {};
      for (let attacks = 1; attacks < 60; attacks++) {
        const b = createGuardian();
        b.attacks = attacks;
        setup(b);
        const move = chooseMove(b, player);
        assert.notEqual(move, b.recent.at(-1));
        count[move] = (count[move] ?? 0) + 1;
        b.recent.push(move);
        assert.notEqual(chooseMove(b, player), move);
      }
      return count;
    };
  };
  const b0 = createGuardian();
  assert.equal(chooseMove(b0, { x: 2500, y: 1100 }), "charge");
  const early = tally(() => {});
  const near = early({ x: 2940 - 90, y: 1100 }),
    far = early({ x: 2940 - 420, y: 1100 });
  assert.equal(near.radiance, undefined);
  assert.equal(far.radiance, undefined);
  assert.ok((near.slam ?? 0) > (far.slam ?? 0));
  assert.ok((far.crystal ?? 0) + (far.charge ?? 0) > (far.slam ?? 0));
  const late = tally((b) => (b.hp = b.maxHp / 2));
  const grounded = late({ x: 2700, y: 1100, onGround: true }),
    airborne = late({ x: 2700, y: 1000, onGround: false });
  assert.ok((airborne.radiance ?? 0) > (grounded.radiance ?? 0));
});
