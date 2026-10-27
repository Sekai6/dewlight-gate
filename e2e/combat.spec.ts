import { test, expect } from "@playwright/test";

test("命中打断预警并产生停顿，提前输入可接上第二次挥斩", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const e = s.enemies[0];
    s.x = e.x - 55;
    s.y = e.floor;
    s.vy = 0;
    s.facing = 1;
  });
  await page.keyboard.press("j");
  const first = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey"),
      e = s.enemies[0];
    for (let n = 0; n < 13; n++) s.update(0, 1000 / 120);
    return { hp: e.hp, phase: e.phase, warning: e.warn, hold: s.hitPause };
  });
  expect(first.hp).toBe(1);
  expect(first.phase).toBe("recover");
  expect(first.warning).toBe(0);
  expect(first.hold).toBeGreaterThan(0);
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    for (let n = 0; n < 31; n++) s.update(0, 1000 / 120);
  });
  await page.keyboard.press("j");
  const second = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey"),
      e = s.enemies[0];
    for (let n = 0; n < 30; n++) s.update(0, 1000 / 120);
    return { hp: e.hp, style: s.attackStyle, dead: e.diedAt };
  });
  expect(second.hp).toBe(0);
  expect(second.style).toBe(1);
  expect(second.dead).toBeGreaterThan(0);
});

test("敌人蓄势与束缚在旅程页暂停，关闭后恢复", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey"),
      e = s.enemies[0];
    s.x = e.x - 110;
    s.y = e.floor;
    s.vy = 0;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).dewlight.scene.getScene("journey").enemies[0].phase,
      ),
    )
    .toBe("windup");
  await page.keyboard.press("Tab");
  const snapshot = () =>
    page.evaluate(() => {
      const s = (window as any).dewlight.scene.getScene("journey"),
        e = s.enemies[0];
      return { clock: s.clock, x: e.x, y: e.y, warn: e.warn, phase: e.phase };
    });
  const frozen = await snapshot();
  await page.waitForTimeout(250);
  expect(await snapshot()).toEqual(frozen);
  await page.keyboard.press("Tab");
  await page.keyboard.press("k");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = (window as any).dewlight.scene.getScene("journey");
        return s.enemies[0].bound > s.clock;
      }),
    )
    .toBe(true);
  const bound = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey"),
      e = s.enemies[0];
    return { warn: e.warn, phase: e.phase };
  });
  expect(bound).toEqual({ warn: 0, phase: "patrol" });
  await page.keyboard.press("Tab");
  const again = await snapshot();
  await page.waitForTimeout(250);
  expect(await snapshot()).toEqual(again);
});
