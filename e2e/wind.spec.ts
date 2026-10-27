import { test, expect } from "@playwright/test";

test("wind landscape geometry animates, reverses and stays still in reduced motion", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    (window as any).dewlight.loop.sleep();
    const s = (window as any).dewlight.scene.getScene("journey");
    const camera = { worldView: { left: 9400, right: 10300 } };
    const geometry = (clock: number, reduced: boolean, turned = {}) => {
      s.windArt.draw(clock, camera, { x: 9800, y: 900 }, reduced, true, turned);
      return JSON.stringify(s.windArt.ink.commandBuffer);
    };
    const normal = geometry(10, false);
    return {
      nonempty: normal.length > 1000,
      moving: normal !== geometry(11, false),
      repeatable: normal === geometry(10, false),
      reversed: normal !== geometry(10, false, { "wind-glide-1": 18 }),
      reduced: geometry(10, true) === geometry(11, true),
    };
  });
  expect(result).toEqual({
    nonempty: true,
    moving: true,
    repeatable: true,
    reversed: true,
    reduced: true,
  });
});

test("updraft lifts, down input escapes, and airborne tailwind changes travel", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => (window as any).dewlight.loop.sleep());
  const jumpVelocity = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.x = 7750;
    s.y = 1000;
    s.vy = -540;
    s.onGround = false;
    s.clock += 1 / 120;
    s.step(1 / 120);
    return s.vy;
  });
  expect(jumpVelocity).toBeLessThan(-520);
  const advance = (x: number, y: number, frames = 36) =>
    page.evaluate(
      ({ x, y, frames }) => {
        const s = (window as any).dewlight.scene.getScene("journey");
        s.x = x;
        s.y = y;
        s.vx = 0;
        s.vy = 0;
        s.onGround = false;
        s.lastGround = -999;
        s.groundIndex = -1;
        for (let i = 0; i < frames; i++) {
          s.clock += 1 / 120;
          s.step(1 / 120);
        }
        return { x: s.x, y: s.y, vy: s.vy };
      },
      { x, y, frames },
    );
  const lifted = await advance(7750, 1000);
  expect(lifted.vy).toBeLessThan(-70);
  expect(lifted.y).toBeLessThan(990);
  await page.keyboard.down("s");
  const escape = await advance(7750, 1000);
  expect(escape.vy).toBeGreaterThan(0);
  expect(escape.y).toBeGreaterThan(1000);
  await page.keyboard.up("s");
  const drift = await advance(9800, 800, 20);
  expect(drift.x).toBeLessThan(9792);
  await page.keyboard.down("s");
  const resisted = await advance(9800, 800, 20);
  expect(resisted.x).toBe(9800);
  await page.keyboard.up("s");
  const ordinary = await advance(8200, 1000, 10);
  expect(ordinary.x).toBe(8200);
  expect(ordinary.vy).toBeGreaterThan(0);
});

test("wind art and physics freeze on the journey page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.x = 7750;
    s.y = 1000;
    s.onGround = false;
    s.vy = 0;
  });
  await page.waitForTimeout(250);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(150);
  const state = () =>
    page.evaluate(() => {
      const s = (window as any).dewlight.scene.getScene("journey");
      return { x: s.x, y: s.y, clock: s.clock };
    });
  const before = await state();
  const picture = await page.locator("canvas").screenshot();
  await page.waitForTimeout(400);
  expect(await state()).toEqual(before);
  expect(await page.locator("canvas").screenshot()).toEqual(picture);
});

test("glass wind flower reverses the current and can be triggered again", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    (window as any).dewlight.loop.sleep();
    const s = (window as any).dewlight.scene.getScene("journey");
    s.x = 9825;
    s.y = 1100;
    s.vx = 0;
    s.vy = 0;
    s.onGround = true;
  });
  const step = () =>
    page.evaluate(() => {
      const s = (window as any).dewlight.scene.getScene("journey");
      s.clock += 1 / 120;
      s.step(1 / 120);
      return {
        now: s.clock,
        until: s.windTurns["wind-glide-1"],
        hp: s.hp,
        energy: s.energy,
      };
    });
  await page.keyboard.press("e");
  const activated = await step();
  expect(activated.until - activated.now).toBeCloseTo(8);
  expect(activated.hp).toBe(5);
  expect(activated.energy).toBe(100);
  await page.keyboard.press("e");
  expect((await step()).until).toBe(-1);
  await page.keyboard.press("e");
  const again = await step();
  expect(again.until - again.now).toBeCloseTo(8);
});
