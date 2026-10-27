import { test, expect } from "@playwright/test";

test("慢行与跑动速度可区分，松开方向后停止", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => (window as any).dewlight.loop.sleep());
  const advance = () =>
    page.evaluate(() => {
      const s = (window as any).dewlight.scene.getScene("journey");
      for (let i = 0; i < 30; i++) {
        s.clock += 1 / 120;
        s.step(1 / 120);
      }
      return s.vx;
    });
  await page.keyboard.down("c");
  await page.keyboard.down("d");
  const walking = await advance();
  await page.keyboard.up("c");
  const running = await advance();
  await page.keyboard.up("d");
  const stopped = await advance();
  const brakeAge = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return s.clock - s.brakeAt;
  });
  expect(brakeAge).toBeLessThan(0.3);
  await page.keyboard.down("d");
  await advance();
  await page.keyboard.up("d");
  await page.keyboard.down("a");
  await advance();
  const pivot = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return { age: s.clock - s.turnAt, facing: s.facing, vx: s.vx };
  });
  expect(pivot.age).toBeLessThan(0.3);
  expect(pivot.facing).toBe(-1);
  expect(pivot.vx).toBeLessThan(0);
  expect(walking).toBeGreaterThan(100);
  expect(running).toBeGreaterThan(walking * 2);
  expect(stopped).toBe(0);
});
