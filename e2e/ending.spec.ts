import { test, expect } from "@playwright/test";

// Fixture state isolates ending UI; the separate route tests prove reachability.
test("结尾统计、继续漫步、确认取消与重开", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const lenses = await page.evaluate(() =>
    (window as any).dewlight.scene
      .getScene("journey")
      .layout.prisms.map((p: any) => p.id),
  );
  await page.addInitScript(
    (lenses) =>
      localStorage.setItem(
        "dewlight.save.v2",
        JSON.stringify({
          version: 2,
          checkpoint: 2,
          stones: [0, 1],
          beads: ["fixture-a", "fixture-b"],
          lenses,
          angles: {},
          logs: ["结尾界面验证"],
          elapsed: 735000,
        }),
      ),
    lenses,
  );
  await page.reload();
  await page.getByRole("button", { name: "继续旅程" }).click();
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey"),
      p = s.layout.stones[2];
    s.x = p.x;
    s.y = p.y;
    s.vy = 0;
  });
  await page.waitForTimeout(100);
  await page.keyboard.press("e", { delay: 80 });
  const before = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return {
      clock: s.clock,
      elapsed: s.layout.elapsed,
      effects: s.effects.lastTime,
    };
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return {
      clock: s.clock,
      elapsed: s.layout.elapsed,
      effects: s.effects.lastTime,
    };
  });
  expect(after.clock).toBe(before.clock);
  expect(after.elapsed).toBe(before.elapsed);
  expect(after.effects).toBeGreaterThan(before.effects);

  await expect(
    page.getByRole("heading", { name: "清晨，为你醒来" }),
  ).toBeVisible();
  await expect(page.locator(".cards")).toContainText("3 / 3");
  await expect(page.locator(".cards")).toContainText("12:");
  await page.screenshot({ path: "test-results/ending-ui.png" });
  await page.getByRole("button", { name: "继续漫步" }).click();
  await expect(page.locator(".overlay")).toHaveCount(0);
  await page.keyboard.press("Tab");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "重新开始", exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("dewlight.save.v2")!).stones,
    ),
  ).toEqual([0, 1, 2]);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "重新开始", exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("dewlight.save.v2")!).stones,
    ),
  ).toEqual([]);
});
