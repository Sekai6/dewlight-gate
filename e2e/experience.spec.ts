import { test, expect } from "@playwright/test";

test("comfort preferences survive refresh and guidance can be restored", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.keyboard.press("Tab");
  await page.getByLabel("静音", { exact: true }).check();
  await page.getByLabel("减少动态效果").check();
  await page.getByLabel("镜头震动").uncheck();
  await page.getByLabel("清晰界面").check();
  await page.getByLabel("寻路引导").uncheck();
  await page.getByLabel("音量", { exact: true }).fill("0.2");
  await page.reload();
  await page.getByRole("button", { name: "操作说明", exact: true }).click();
  await expect(page.getByLabel("静音", { exact: true })).toBeChecked();
  await expect(page.getByLabel("减少动态效果")).toBeChecked();
  await expect(page.getByLabel("镜头震动")).not.toBeChecked();
  await expect(page.getByLabel("寻路引导")).not.toBeChecked();
  await expect(page.getByLabel("音量", { exact: true })).toHaveValue("0.2");
  await expect(page.locator("#ui")).toHaveAttribute("data-contrast", "high");
});

test("continue restores a real safe upper landing rather than GATE", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    s.x = 700;
    s.y = 1010;
    s.vx = 0;
    s.vy = 120;
    s.onGround = false;
    for (let n = 0; n < 20; n++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
  });
  await page.keyboard.press("Tab");
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("dewlight.save.v2")!).position,
  );
  expect(saved).toEqual({ x: 700, y: 1020 });
  await page.reload();
  await expect(page.locator(".continue-summary")).toContainText("露水门廊");
  await page.getByRole("button", { name: "继续旅程" }).click();
  const resumed = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return { x: s.x, y: s.y };
  });
  expect(resumed).toEqual(saved);
});

test("return to checkpoint heals and keeps collections, lenses and trials", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.activatePrism(s.layout.prisms.find((p: any) => p.id === "lens-0-0"));
    s.recordTrial(0, "rise");
    s.hp = 1;
    s.energy = 5;
    s.x = 3000;
    s.y = 1100;
  });
  await page.keyboard.press("Tab");
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dewlight.save.v2")!),
  );
  await page.getByRole("button", { name: "回到检查点", exact: true }).click();
  const after = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return {
      x: s.x,
      hp: s.hp,
      energy: s.energy,
      save: JSON.parse(localStorage.getItem("dewlight.save.v2")!),
    };
  });
  expect(after.x).toBe(130);
  expect(after.hp).toBe(5);
  expect(after.energy).toBe(100);
  expect(after.save.beads).toEqual(before.beads);
  expect(after.save.lenses).toEqual(before.lenses);
  expect(after.save.trials).toEqual(before.trials);
});

test("dash accepts a short early input and pause clears its buffer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    s.dashAt = s.clock - 1.04;
  });
  await page.keyboard.press("Shift");
  const age = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    for (let n = 0; n < 12; n++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    return s.clock - s.dashAt;
  });
  expect(age).toBeLessThan(0.05);
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.dashAt = s.clock - 1.04;
  });
  await page.keyboard.press("Shift");
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.clock += 1 / 120;
    s.step(1 / 120);
  });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const cleared = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    for (let n = 0; n < 15; n++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    return s.clock - s.dashAt;
  });
  expect(cleared).toBeGreaterThan(1.1);
  await page.keyboard.press("Shift");
  const fresh = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.clock += 1 / 120;
    s.step(1 / 120);
    return s.clock - s.dashAt;
  });
  expect(fresh).toBeLessThan(0.02);
});

test("nearby beads drift in once and show a compact collection receipt", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.waitForTimeout(200);
  const count = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.beads = [{ id: "experience-bead", x: s.x + 72, y: s.y - 28 }];
    return s.collected.size;
  });
  await page.waitForTimeout(200);
  await expect(page.getByLabel("收集反馈")).toContainText("玻璃珠");
  const next = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return { count: s.collected.size, has: s.collected.has("experience-bead") };
  });
  expect(next).toEqual({ count: count + 1, has: true });
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").collected.size,
    ),
  ).toBe(count + 1);
});

test("an awakened monument offers repeatable rest", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey"),
      p = s.layout.stones[0];
    s.guardian.hp = 0;
    s.guardian.phase = "defeated";
    s.x = p.x;
    s.y = p.y;
    s.vx = 0;
    s.vy = 0;
  });
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.hp = 2;
    s.energy = 9;
  });
  await page.keyboard.press("e");
  await page.waitForTimeout(100);
  const state = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey"),
      v = JSON.parse(localStorage.getItem("dewlight.save.v2")!);
    return {
      hp: s.hp,
      energy: s.energy,
      stones: v.stones,
      checkpoint: v.checkpoint,
    };
  });
  expect(state).toEqual({ hp: 5, energy: 100, stones: [0], checkpoint: 1 });
});
