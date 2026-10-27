import { test, expect } from "@playwright/test";
test("实际键盘移动、跳跃、暂停按钮稳定、失焦暂停与恢复", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.screenshot({ path: "test-results/title.png" });
  await page.getByRole("button", { name: "开启旅程" }).click();
  const read = () =>
    page.evaluate(() => {
      const s = (window as any).dewlight.scene.getScene("journey");
      return { x: s.x, y: s.y, clock: s.clock };
    });
  const initial = await read();
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  await page.keyboard.up("d");
  expect((await read()).x).toBeGreaterThan(initial.x + 60);
  await page.keyboard.press("Space", { delay: 80 });
  await page.waitForTimeout(100);
  expect((await read()).y).toBeLessThan(1090);
  await page.getByRole("button", { name: "暂停旅程" }).click();
  const paused = await read();
  await page.waitForTimeout(300);
  expect(await read()).toEqual(paused);
  await page.getByRole("button", { name: "日志", exact: true }).click();
  await expect(page.locator(".logs")).toContainText("GATE");
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(
    page.getByRole("heading", { name: "暂停 · 旅程手记" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/garden.png" });
  expect(errors).toEqual([]);
});
test("石碑检查点、坠落与倒下、资源去重、刷新恢复和重新开始", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.guardian.hp = 0;
    s.guardian.phase = "defeated";
    const p = s.layout.stones[0];
    s.x = p.x;
    s.y = p.y;
    s.vy = 0;
  });
  await page.waitForTimeout(100);
  await page.keyboard.press("e", { delay: 80 });
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dewlight.save.v2")!),
  );
  expect(before.stones).toEqual([0]);
  const after = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.hp = 1;
    s.damage(true);
    return { hp: s.hp, energy: s.energy, x: s.x, vy: s.vy };
  });
  expect(after).toMatchObject({ hp: 5, energy: 100, vy: 0 });
  expect(after.x).toBe(3255);
  await page.reload();
  await page.getByRole("button", { name: "继续旅程" }).click();
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").x,
    ),
  ).toBe(3255);
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "背包", exact: true }).click();
  await expect(page.locator(".cards")).toContainText("晨露碑印记");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "重新开始", exact: true }).click();
  const reset = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dewlight.save.v2")!),
  );
  expect(reset.stones).toEqual([]);
  expect(reset.lenses).toEqual([]);
  expect(reset.beads).toEqual([]);
});
test("平台冻结五秒、平滑恢复与重复触发", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const p = s.layout.platforms.find((p: any) => p.moving);
    s.x = p.x - 40;
    s.y = p.y;
    s.facing = 1;
    s.keys.K._justDown = true;
    s.clock += 1 / 120;
    s.step(1 / 120);
    const id = s.layout.platforms.findIndex(
        (v: any) => v.x === p.x && v.moving,
      ),
      frozen = s.layout.platforms[id];
    for (let i = 0; i < 120 * 4; i++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    const during = s.layout.platforms[id];
    for (let i = 0; i < 120 + 1; i++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    const prior = s.layout.platforms[id];
    s.clock += 1 / 120;
    s.step(1 / 120);
    const after = s.layout.platforms[id];
    s.x = p.x - 40;
    s.y = after.y;
    s.facing = 1;
    s.keys.K._justDown = true;
    s.clock += 1 / 120;
    s.step(1 / 120);
    return {
      initialY: frozen.y,
      duringY: during.y,
      thawDelta: Math.abs(after.y - prior.y),
      repeat: s.layout.platforms[id].frozen > s.clock,
    };
  });
  expect(result.initialY).toBe(result.duringY);
  expect(result.thawDelta).toBeLessThan(1);
  expect(result.repeat).toBe(true);
});
test("存储被禁用仍能开始与游玩，显示保存提示", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("disabled");
    };
    Storage.prototype.getItem = () => {
      throw new Error("disabled");
    };
  });
  await page.goto("/");
  await expect(page.locator(".notice")).toContainText("无法保存");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.keyboard.press("Tab");
  await expect(page.locator(".notice")).toContainText("无法保存");
});
test("查看标题操作说明不会覆盖已有存档", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.waitForTimeout(200);
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "回到标题" }).click();
  const before = await page.evaluate(() =>
    localStorage.getItem("dewlight.save.v2"),
  );
  await page.reload();
  await page.getByRole("button", { name: "操作说明", exact: true }).click();
  await page.getByRole("button", { name: "回到标题" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("dewlight.save.v2")),
  ).toBe(before);
});
