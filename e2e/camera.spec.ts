import { test, expect } from "@playwright/test";
test("镜头跟随真实跑跳，暂停冻结镜头与变焦，返回后继续", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.keyboard.down("d");
  await page.waitForTimeout(1600);
  await page.keyboard.up("d");
  await page.waitForTimeout(600);
  const read = () =>
    page.evaluate(() => {
      const s = (window as any).dewlight.scene.getScene("journey"),
        c = s.cameras.main;
      return {
        x: c.scrollX,
        y: c.scrollY,
        zoom: c.zoom,
        px: s.x,
        py: s.y,
        w: s.scale.width,
        h: s.scale.height,
      };
    });
  const before = await read();
  await page.keyboard.press("Space");
  await page.waitForTimeout(160);
  const jump = await read();
  expect(jump.py).toBeLessThan(before.py - 30);
  expect(Math.abs(jump.y - before.y)).toBeLessThan(25);
  await page.keyboard.press("Tab");
  const frozen = await read();
  await page.waitForTimeout(400);
  expect(await read()).toEqual(frozen);
  await page.getByRole("button", { name: "继续探索" }).click();
  await page.waitForTimeout(700);
  const after = await read();
  const screenX = (after.px - after.x) * after.zoom;
  const screenY = (after.py - after.y) * after.zoom;
  expect(screenX).toBeGreaterThan(0);
  expect(screenX).toBeLessThan(after.w);
  expect(screenY).toBeGreaterThan(0);
  expect(screenY).toBeLessThan(after.h);
  expect(errors).toEqual([]);
});
