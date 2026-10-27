import { test, expect } from "@playwright/test";

test("折光方向、固定叶台、守卫束缚各有真实通关条件", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const tick = () => {
      s.clock += 1 / 120;
      s.step(1 / 120);
    };
    function setup(id: string) {
      const p = s.layout.prisms.find((p: any) => p.id === id);
      for (const previous of s.layout.prisms.filter(
        (v: any) => v.room === p.room && v.order < p.order,
      ))
        s.activatePrism({ ...previous, mechanic: "touch" });
      s.x = p.x;
      s.y = p.y;
      s.facing = 1;
      return p;
    }
    const reflect = setup("lens-1-1");
    s.activatePrism(reflect);
    const wrong = !s.layout.lenses.includes(reflect.id);
    for (let n = 0; n < 3 && !s.layout.lenses.includes(reflect.id); n++)
      s.activatePrism(reflect);
    const aligned = s.layout.lenses.includes(reflect.id);
    const hold = setup("lens-3-2");
    s.activatePrism(hold);
    const refusedHold = !s.layout.lenses.includes(hold.id);
    s.keys.K._justDown = true;
    tick();
    s.activatePrism(hold);
    const fixed = s.layout.lenses.includes(hold.id);
    const guard = setup("lens-4-0");
    const e = s.enemies.find((e: any) => e.guard === guard.id);
    s.activatePrism(guard);
    const refusedGuard = !s.layout.lenses.includes(guard.id);
    s.clock += 1;
    s.keys.K._justDown = true;
    tick();
    s.activatePrism(guard);
    const quiet = s.layout.lenses.includes(guard.id),
      alive = e.hp > 0;
    return { wrong, aligned, refusedHold, fixed, refusedGuard, quiet, alive };
  });
  expect(result).toEqual({
    wrong: true,
    aligned: true,
    refusedHold: true,
    fixed: true,
    refusedGuard: true,
    quiet: true,
    alive: true,
  });
});
test("向下穿过平台有实际控制输入，地面不会穿透", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.x = 550;
    s.y = 1020;
    s.vy = 0;
  });
  await page.waitForTimeout(100);
  await page.keyboard.down("s");
  await page.keyboard.press("Space", { delay: 60 });
  await page.keyboard.up("s");
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").y,
    ),
  ).toBe(1100);
  await page.keyboard.down("s");
  await page.keyboard.press("Space", { delay: 60 });
  await page.keyboard.up("s");
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").y,
    ),
  ).toBeLessThanOrEqual(1100);
});
