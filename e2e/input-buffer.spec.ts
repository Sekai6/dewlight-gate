import { test, expect } from "@playwright/test";
test("两帧之间完成的短按仍触发一次攻击，暂停清空缓存", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const e = s.enemies[0];
    s.x = e.x - 50;
    s.y = e.y;
    s.facing = 1;
  });
  await page.keyboard.press("j");
  const result = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey"),
      e = s.enemies[0];
    const queued = s.pendingKeys.has("J");
    s.clock += 1 / 120;
    s.step(1 / 120);
    const first = e.hp;
    s.clock += 0.1;
    s.step(1 / 120);
    const impact = e.hp;
    s.clock += 0.6;
    s.step(1 / 120);
    return {
      queued,
      first,
      impact,
      second: e.hp,
      pending: s.pendingKeys.has("J"),
    };
  });
  expect(result).toEqual({
    queued: true,
    first: 2,
    impact: 1,
    second: 1,
    pending: false,
  });
  await page.keyboard.press("k");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").pendingKeys.size,
    ),
  ).toBe(0);
});
