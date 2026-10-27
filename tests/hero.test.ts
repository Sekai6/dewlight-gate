import { test } from "node:test";
import assert from "node:assert/strict";
import { heroFrame, heroSwordPose, heroFootPose } from "../src/hero.ts";
test("walking and running plant the sole and lift the recovery leg continuously", () => {
  for (const running of [false, true]) {
    assert.equal(heroFootPose(0.1, running).y, 0);
    assert.equal(heroFootPose(0.4, running).y, 0);
    assert.ok(heroFootPose(0.8, running).y < -4);
    assert.deepEqual(heroFootPose(0, running), heroFootPose(1, running));
    assert.ok(
      Math.abs(heroFootPose(0.9999, running).x - heroFootPose(0, running).x) <
        0.01,
    );
  }
  assert.ok(heroFootPose(0.8, true).y < heroFootPose(0.8, false).y);
});
const pose = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  facing: 1,
  onGround: true,
  clock: 10,
  attackAt: -999,
  bindAt: -999,
  dashAt: -999,
  hurtAt: -999,
};
test("动作中断优先级与起跳落地帧有效，恢复后能继续移动", () => {
  assert.ok(heroFrame({ ...pose, attackAt: 9.9, dashAt: 9.95 }) >= 72);
  const hurt = heroFrame({
    ...pose,
    attackAt: 9.9,
    dashAt: 9.95,
    hurtAt: 9.98,
  });
  assert.ok(hurt >= 84 && hurt < 96);
  const jump = heroFrame({
    ...pose,
    onGround: false,
    launchAt: 9.95,
    vy: -450,
  });
  assert.ok(jump >= 120 && jump < 132);
  const land = heroFrame({ ...pose, landAt: 9.9 });
  assert.ok(land >= 108 && land < 120);
  const run = heroFrame({ ...pose, landAt: 9.9, vx: 255, stride: 0.4 });
  assert.ok(run >= 24 && run < 36);
  const movingCut = heroFrame({ ...pose, vx: 255, attackAt: 9.9 });
  assert.ok(movingCut >= 132 && movingCut < 144);
  const movingRise = heroFrame({
    ...pose,
    vx: -255,
    attackAt: 9.9,
    attackStyle: 1,
  });
  assert.ok(movingRise >= 144 && movingRise < 156);
  const planted = heroFrame({ ...pose, vx: 0, attackAt: 9.9 });
  assert.ok(planted >= 48 && planted < 60);
  const turn = heroFrame({ ...pose, turnAt: 9.95, vx: -80 });
  assert.ok(turn >= 156 && turn < 168);
  const brake = heroFrame({ ...pose, brakeAt: 9.95, vx: 20 });
  assert.ok(brake >= 168 && brake < 180);
  const interrupted = heroFrame({ ...pose, turnAt: 9.95, attackAt: 9.9 });
  assert.ok(interrupted >= 48 && interrupted < 60);
});

test("sword anticipation, contact and recovery remain continuous", () => {
  for (const rising of [false, true]) {
    assert.deepEqual(heroSwordPose(0, rising), { x: 12, y: -29, angle: 0.45 });
    const ready = heroSwordPose(1, rising);
    assert.ok(
      Math.abs(ready.x - 12) < 1e-8 &&
        Math.abs(ready.y + 29) < 1e-8 &&
        Math.abs(ready.angle - 0.45) < 1e-8,
    );
    for (const boundary of [0.16, 0.34, 0.58]) {
      const before = heroSwordPose(boundary - 0.00001, rising);
      const after = heroSwordPose(boundary + 0.00001, rising);
      assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 0.01);
      assert.ok(Math.abs(after.angle - before.angle) < 0.01);
    }
    const contact = heroSwordPose(0.34, rising);
    assert.ok(contact.x >= 24 && contact.y < -30);
  }
});
