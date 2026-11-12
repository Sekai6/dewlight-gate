import { test, expect } from "@playwright/test";
test("first guardian has a safe opening, freezes in menus, can be defeated and saved", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").guardian.phase,
    ),
  ).toBe("sleep");
  await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    s.x = 2500;
    s.y = 1100;
    s.vx = 0;
    s.vy = 0;
    s.onGround = true;
    s.clock += 1 / 120;
    s.step(1 / 120);
    s.draw();
  });
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").guardian.phase,
    ),
  ).toBe("intro");
  await page.keyboard.press("Tab");
  const before = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return JSON.stringify(s.guardian);
  });
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    for (let n = 0; n < 120; n++) s.update(0, 16.67);
  });
  expect(
    await page.evaluate(() =>
      JSON.stringify(
        (window as any).dewlight.scene.getScene("journey").guardian,
      ),
    ),
  ).toBe(before);
  await page.keyboard.press("Tab");
  const result = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    // Chase, dodge warning, and punish using actual inputs without moving the actor by hand.
    for (let n = 0; n < 120 * 120 && s.guardian.hp > 0; n++) {
      const b = s.guardian,
        dx = b.x - s.x;
      s.keys.A.isDown = dx < -65;
      s.keys.D.isDown = dx > 65;
      s.facing = dx > 0 ? 1 : -1;
      if ((b.phase === "warn" || b.phase === "slam-warn") && s.onGround)
        s.keys.SPACE._justDown = true;
      if (n % 48 === 0) s.keys.ATTACK._justDown = true;
      if (n % 200 === 0) s.keys.BIND._justDown = true;
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    s.keys.A.isDown = false;
    s.keys.D.isDown = false;
    return { hp: s.guardian.hp, phase: s.guardian.phase };
  });
  expect(result).toEqual({ hp: 0, phase: "defeated" });
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.x = 3320;
    s.y = 1100;
    s.vx = 0;
    s.vy = 0;
    s.keys.F._justDown = true;
    s.clock += 1 / 120;
    s.step(1 / 120);
  });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dewlight.save.v2")!),
  );
  expect(saved.stones).toContain(0);
  expect(
    saved.beads.filter((id: string) => id === "boss-dew-crown"),
  ).toHaveLength(1);
  await page.reload();
  await page.getByRole("button", { name: "继续旅程" }).click();
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").guardian.phase,
    ),
  ).toBe("defeated");
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.x = 3580;
    s.y = 1100;
    s.vx = 0;
    s.keys.F._justDown = true;
    s.clock += 1 / 120;
    s.step(1 / 120);
  });
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").x,
    ),
  ).toBeGreaterThan(12000);
  await page.keyboard.press("f");
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").x,
    ),
  ).toBeGreaterThan(3700);
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").x,
    ),
  ).toBeLessThan(4000);
});
