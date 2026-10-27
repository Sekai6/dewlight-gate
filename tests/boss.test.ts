import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGuardian,
  stepGuardian,
  hitGuardian,
  bindGuardian,
} from "../src/boss.ts";
test("guardian preserves safe opening, warns before a locked-direction charge, then recovers", () => {
  const b = createGuardian();
  stepGuardian(b, 10, 0.01, { x: 200, y: 1100 });
  assert.equal(b.phase, "sleep");
  assert.equal(stepGuardian(b, 11, 0.01, { x: 2500, y: 1100 }).started, true);
  stepGuardian(b, 13, 0.01, { x: 2500, y: 1100 });
  stepGuardian(b, 14, 0.01, { x: 2500, y: 1100 });
  assert.equal(b.phase, "warn");
  stepGuardian(b, 14.5, 0.01, { x: 3100, y: 1100 });
  assert.equal(b.facing, -1);
  stepGuardian(b, 15.1, 0.01, { x: 3100, y: 1100 });
  assert.equal(b.phase, "charge");
  stepGuardian(b, 16.3, 0.01, { x: 3100, y: 1100 });
  assert.equal(b.phase, "recover");
});
test("ordinary hits work, openings reward damage, and roots can be jumped or interrupted", () => {
  const b = createGuardian();
  b.phase = "stalk";
  assert.equal(hitGuardian(b, 1), true);
  assert.equal(b.hp, 35);
  b.phase = "recover";
  hitGuardian(b, 2);
  assert.equal(b.hp, 33);
  b.phase = "stalk";
  b.attacks = 1;
  b.until = 3;
  stepGuardian(b, 3, 1 / 120, { x: 2600, y: 1100 });
  assert.equal(b.phase, "slam-warn");
  stepGuardian(b, 4.1, 1 / 120, { x: 2600, y: 1100 });
  assert.equal(b.wave.length, 2);
  const before = b.hp;
  assert.equal(bindGuardian(b, 4.2), true);
  assert.equal(b.wave.length, 0);
  assert.equal(bindGuardian(b, 6.5), false);
  assert.equal(b.hp, before);
  b.phase = "recover";
  b.until = 99;
  b.wave = [{ x: 2600, dir: 1, hit: false }];
  assert.equal(stepGuardian(b, 5, 0.05, { x: 2610, y: 1040 }).damage, false);
  assert.equal(stepGuardian(b, 5.1, 0.05, { x: 2620, y: 1100 }).damage, true);
  assert.equal(stepGuardian(b, 5.2, 0.05, { x: 2630, y: 1100 }).damage, false);
});
test("guardian binding interrupts charge and repeat hits cannot duplicate defeat", () => {
  const b = createGuardian();
  b.phase = "charge";
  assert.equal(hitGuardian(b, 0), true);
  assert.equal(bindGuardian(b, 1), true);
  assert.equal(b.phase, "bound");
  assert.equal(bindGuardian(b, 1.1), false);
  const x = b.x;
  stepGuardian(b, 1.2, 0.2, { x: 2500, y: 1100 });
  assert.equal(b.x, x);
  for (let n = 0; n < 18; n++) assert.equal(hitGuardian(b, 2 + n), true);
  assert.equal(b.phase, "defeated");
  assert.equal(hitGuardian(b, 20), false);
  assert.equal(createGuardian(true).phase, "defeated");
});
