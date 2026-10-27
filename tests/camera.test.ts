import { test } from "node:test";
import assert from "node:assert/strict";
import { JourneyCamera } from "../src/camera.ts";
const pose = () => ({
  x: 2400,
  y: 800,
  vx: 255,
  vy: 0,
  clock: 1,
  onGround: true,
  dashAt: -999,
  attackAt: -999,
});
test("arena camera fits both combat boundaries at desktop sizes and freezes on pause", () => {
  for (const width of [1024, 1440, 1920]) {
    const c = new JourneyCamera();
    const p = {
      ...pose(),
      y: 1100,
      arena: { left: 2380, right: 3160, floor: 1100 },
    };
    c.update(p, width, 768, 1.1, 36000, 1100, false);
    for (let n = 0; n < 240; n++) {
      p.clock += 1 / 120;
      p.x = n % 2 ? 2420 : 3110;
      c.update(p, width, 768, 1.1, 36000, 1100, false);
    }
    assert.ok(c.x < 2380 - 60);
    assert.ok(c.x + width / c.zoom > 3160 + 60);
    const frozen = [c.x, c.y, c.zoom];
    for (let n = 0; n < 10; n++)
      c.update(p, width, 768, 1.1, 36000, 1100, false);
    assert.deepEqual([c.x, c.y, c.zoom], frozen);
  }
});
test("镜头在暂停时冻结，远距离复活立即重构图，窗口变化仍能适配", () => {
  const c = new JourneyCamera(),
    p = pose();
  c.update(p, 1280, 800, 1, 36000, 1100, false);
  p.clock += 0.1;
  p.x += 25;
  c.update(p, 1280, 800, 1, 36000, 1100, false);
  const frozen = [c.x, c.y, c.zoom];
  for (let n = 0; n < 60; n++) c.update(p, 1280, 800, 1, 36000, 1100, false);
  assert.deepEqual([c.x, c.y, c.zoom], frozen);
  p.x = 130;
  p.y = 1100;
  c.update(p, 1280, 800, 1, 36000, 1100, false);
  assert.equal(c.x, 0);
  c.update(p, 1920, 1080, 1.35, 36000, 1100, false);
  assert.equal(c.zoom, 1.35);
});
test("跳跃缓冲区保持地平线，左右跑动均保留前视空间", () => {
  const c = new JourneyCamera(),
    p = pose();
  c.update(p, 1280, 800, 1, 36000, 1100, false);
  const groundY = c.y;
  p.onGround = false;
  p.y -= 80;
  p.vy = -200;
  p.clock += 1 / 60;
  c.update(p, 1280, 800, 1, 36000, 1100, false);
  assert.equal(c.y, groundY);
  p.onGround = true;
  p.y = 800;
  for (const direction of [1, -1]) {
    p.vx = direction * 255;
    for (let n = 0; n < 180; n++) {
      p.clock += 1 / 60;
      p.x += p.vx / 60;
      c.update(p, 1280, 800, 1, 36000, 1100, false);
    }
    const screenX = p.x - c.x;
    assert.ok(direction > 0 ? screenX < 640 : screenX > 640);
    assert.ok(screenX > 250 && screenX < 1030);
  }
});

test("石碑构图会拉远，暂停冻结，离开后恢复，减少动态不变焦", () => {
  const c = new JourneyCamera(),
    p = pose();
  c.update(p, 1280, 800, 1, 36000, 1100, false);
  c.awaken(p.x + 50, p.y, p.clock);
  for (let n = 0; n < 60; n++) {
    p.clock += 1 / 60;
    c.update(p, 1280, 800, 1, 36000, 1100, false);
  }
  assert.ok(c.zoom < 0.97);
  const frozen = [c.x, c.y, c.zoom];
  c.update(p, 1280, 800, 1, 36000, 1100, false);
  assert.deepEqual([c.x, c.y, c.zoom], frozen);
  p.x += 400;
  for (let n = 0; n < 100; n++) {
    p.clock += 1 / 60;
    c.update(p, 1280, 800, 1, 36000, 1100, false);
  }
  assert.ok(c.zoom > 0.995);
  c.reset();
  c.awaken(p.x, p.y, p.clock);
  p.clock += 1;
  c.update(p, 1280, 800, 1, 36000, 1100, true);
  assert.equal(c.zoom, 1);
});
