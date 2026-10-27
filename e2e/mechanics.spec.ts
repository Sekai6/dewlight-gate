import { test, expect } from "@playwright/test";

test("20fps 与 60fps 移动距离及物理时间一致", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    function run(fps: number) {
      s.resetWorld();
      s.keys.D.isDown = true;
      for (let i = 0; i < fps; i++) s.update(0, 1000 / fps);
      return { x: s.x, clock: s.clock };
    }
    return { fast: run(60), slow: run(20) };
  });
  expect(Math.abs(result.fast.x - result.slow.x)).toBeLessThan(3);
  expect(result.fast.clock).toBeCloseTo(1, 1);
  expect(result.slow.clock).toBeCloseTo(1, 1);
});
test("攻击确实扣除敌人生命，掉落不因重载重复获得；敌人束缚持续三秒", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const e = s.enemies[0];
    s.x = e.x - 55;
    s.y = e.y;
    s.facing = 1;
    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        s.clock += 1 / 120;
        s.step(1 / 120);
      }
    };
    s.keys.K._justDown = true;
    step(1);
    const boundUntil = e.bound,
      energy = s.energy;
    step(120 * 2);
    const held = e.bound > s.clock;
    s.keys.J._justDown = true;
    step(13);
    const hpAfterFirst = e.hp;
    step(60);
    s.keys.J._justDown = true;
    step(13);
    const hpAfterSecond = e.hp;
    s.clock = boundUntil + 0.1;
    step(1);
    const expired = e.bound < s.clock;
    return { energy, held, expired, hpAfterFirst, hpAfterSecond };
  });
  expect(result.energy).toBe(75);
  expect(result.held).toBe(true);
  expect(result.expired).toBe(true);
  expect(result.hpAfterFirst).toBe(1);
  expect(result.hpAfterSecond).toBe(0);
});
test("短暂离地宽限、提前按跳缓冲与冲刺冷却", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const tick = (n = 1) => {
      for (let i = 0; i < n; i++) {
        s.clock += 1 / 120;
        s.step(1 / 120);
      }
    };
    s.x = 1600;
    s.y = 1050;
    s.vy = 0;
    s.onGround = false;
    s.lastGround = s.clock - 0.08;
    s.keys.SPACE._justDown = true;
    tick();
    const coyote = s.vy < 0;
    s.x = 1600;
    s.y = 1090;
    s.vy = 100;
    s.onGround = false;
    s.lastGround = -999;
    s.keys.SPACE._justDown = true;
    tick(15);
    const buffered = s.vy < 0;
    s.keys.SHIFT._justDown = true;
    tick();
    const first = s.dashAt;
    tick(20);
    s.keys.SHIFT._justDown = true;
    tick();
    const blocked = s.dashAt === first;
    tick(120);
    s.keys.SHIFT._justDown = true;
    tick();
    const ready = s.dashAt > first;
    return { coyote, buffered, blocked, ready };
  });
  expect(result).toEqual({
    coyote: true,
    buffered: true,
    blocked: true,
    ready: true,
  });
});
test("受伤保护与冲刺保护阻止重复扣血，死亡保留已收集资源", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    s.damage(false);
    const first = s.hp;
    s.damage(false);
    const protectedHp = s.hp;
    s.clock += 2;
    s.dashAt = s.clock;
    s.damage(false);
    const dashHp = s.hp;
    // Collect through the actual proximity mechanic before dying.
    const bead = s.beads.find((b: any) => b.x > 300);
    s.x = bead.x;
    s.y = bead.y + 28;
    s.vy = 0;
    s.clock += 1 / 120;
    s.step(1 / 120);
    const collectedId = bead.id;
    s.hp = 1;
    s.damage(true);
    return { first, protectedHp, dashHp, collectedId, hp: s.hp };
  });
  expect(result).toMatchObject({ first: 4, protectedHp: 4, dashHp: 4, hp: 5 });
  await page.keyboard.press("Tab");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dewlight.save.v2")!),
  );
  expect(saved.beads).toContain(result.collectedId);
});
