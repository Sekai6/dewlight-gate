import { test } from "node:test";
import assert from "node:assert/strict";
import { stepCreature, hurtCreature, type Enemy } from "../src/creature.ts";

function creature(type = 0): Enemy {
  return {
    x: 0,
    y: 100,
    home: 0,
    floor: 100,
    type,
    hp: 2,
    dir: 1,
    bound: 0,
    warn: 0,
    cool: 0,
    id: "test",
    phase: "patrol",
    phaseAt: 0,
    hurtAt: -999,
    diedAt: -999,
    attackDir: 1,
    attackHit: false,
    minX: -90,
    maxX: 90,
    gait: 0,
  };
}
test("敌人预警锁定方向，移动到背后能躲过扑击", () => {
  const e = creature();
  const front = { x: 70, y: 100 };
  assert.equal(stepCreature(e, 1, 1 / 120, front), false);
  assert.equal(e.phase, "windup");
  const behind = { x: -70, y: 100 };
  let hits = 0;
  for (let n = 1; n <= 140; n++)
    if (stepCreature(e, 1 + n / 120, 1 / 120, behind)) hits++;
  assert.equal(hits, 0);
  assert.ok(e.x > 0);
  assert.equal(e.phase, "recover");
});
test("扑击只结算一次且不会越过平台边缘", () => {
  const e = creature();
  const player = { x: 55, y: 100 };
  let hits = 0;
  for (let n = 1; n <= 170; n++)
    if (stepCreature(e, n / 120, 1 / 120, player)) hits++;
  assert.equal(hits, 1);
  for (let n = 170; n < 1500; n++)
    stepCreature(e, n / 120, 1 / 120, { x: 300, y: 100 });
  assert.ok(e.x >= e.minX && e.x <= e.maxX);
});
test("束缚取消蓄势，解开后需要重新预警；受击与死亡取消攻击", () => {
  const e = creature(1),
    p = { x: 65, y: 56 };
  stepCreature(e, 1, 1 / 120, p);
  assert.equal(e.phase, "windup");
  e.bound = 4;
  stepCreature(e, 2, 1 / 120, p);
  assert.equal(e.warn, 0);
  const x = e.x,
    y = e.y;
  stepCreature(e, 3, 1 / 120, p);
  assert.equal(e.x, x);
  assert.equal(e.y, y);
  assert.equal(stepCreature(e, 4.1, 1 / 120, p), false);
  assert.equal(e.phase, "windup");
  hurtCreature(e, 4.2, 1);
  assert.equal(e.hp, 1);
  assert.equal(e.warn, 0);
  assert.equal(e.phase, "recover");
  hurtCreature(e, 4.7, 1);
  assert.equal(e.hp, 0);
  assert.equal(stepCreature(e, 6, 1, p), false);
  assert.equal(e.diedAt, 4.7);
});
