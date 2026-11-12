import { test, expect } from "@playwright/test";

test("Q/R/F keyboard linkage, pause, resource feedback and legacy save", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  await expect(page.locator(".skill-slot")).toHaveCount(3);
  await page.keyboard.press("r");
  await expect(page.locator(".toast")).toContainText("仅空中");
  await page.keyboard.press("q");
  await page.waitForTimeout(170);
  await page.keyboard.press("e");
  await page.waitForTimeout(350);
  await page.keyboard.press("r");
  await page.waitForTimeout(180);
  const state = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return {
      energy: s.energy,
      active: s.skills.active?.skill,
      y: s.y,
      hp: s.hp,
    };
  });
  expect(state.energy).toBeCloseTo(20, 0);
  expect(state.active).toBe("bloom");
  expect(state.y).toBeLessThan(1090);
  await page.keyboard.press("Escape");
  const paused = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return JSON.stringify({
      clock: s.clock,
      skill: s.skills.snapshot(),
      energy: s.energy,
      y: s.y,
    });
  });
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => {
      const s = (window as any).dewlight.scene.getScene("journey");
      return JSON.stringify({
        clock: s.clock,
        skill: s.skills.snapshot(),
        energy: s.energy,
        y: s.y,
      });
    }),
  ).toBe(paused);
  await page.reload();
  await page.locator('[data-action="continue"]').click();
  const restored = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return {
      active: s.skills.active,
      cd: Object.fromEntries(
        ["branch", "bloom", "rise"].map((id) => [id, s.skills.cooldowns[id]]),
      ),
      energy: s.energy,
    };
  });
  expect(restored.active).toBeNull();
  expect(restored.cd).toEqual({ branch: 0, rise: 0, bloom: 0 });
  expect(restored.energy).toBe(100);
  expect(errors).toEqual([]);
});
