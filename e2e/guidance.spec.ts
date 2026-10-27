import { test, expect } from "@playwright/test";

test("guide text keeps its screen size on a high density display", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const height = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return (
      (s.guideArt.label.displayHeight * s.cameras.main.zoom) /
      window.devicePixelRatio
    );
  });
  expect(height).toBeGreaterThan(20);
  expect(height).toBeLessThan(32);
  const left = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey"),
      cam = s.cameras.main;
    s.guideArt.draw(
      s.clock,
      cam,
      s,
      {
        x: cam.worldView.left - 1000,
        y: 700,
        action: "沿平台前行，靠近光箭头",
      },
      true,
      false,
    );
    return (
      s.guideArt.label.x -
      s.guideArt.label.displayWidth / 2 -
      cam.worldView.left
    );
  });
  expect(left).toBeGreaterThan(0);
  await context.close();
});

test("objective banner contracts, can be hidden, and advances after a lens", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await expect(page.getByLabel("当前旅程目标")).toContainText("点亮门廊微光");
  const first = await page.evaluate(
    () => (window as any).dewlight.scene.getScene("journey").nextGuideStep,
  );
  expect(first.y).toBe(1020);
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.clock += 7;
  });
  await expect(page.locator(".quest-banner")).toHaveClass(/settled/);
  await page.keyboard.press("h");
  await expect(page.locator(".quest-banner")).toHaveCount(0);
  await page.keyboard.press("h");
  await expect(page.locator(".quest-banner")).toBeVisible();
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.x = 620;
    s.y = 1020;
    s.vy = 0;
    const lens = s.layout.prisms.find((p: any) => p.id === "lens-0-0");
    s.activatePrism(lens);
  });
  await expect(page.getByLabel("当前旅程目标")).toContainText("点亮蕨叶露珠");
  await expect(page.locator(".quest-banner")).toHaveClass(/unfurled/);
  await page.keyboard.press("Tab");
  await expect(page.locator(".current-quest")).toContainText("点亮蕨叶露珠");
  await expect(page.locator(".trial-card")).toContainText("没有时限");
});

test("real wind riding and a wind flower earn a persistent optional seal", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    s.x = 7750;
    s.y = 1080;
    s.vx = 0;
    s.vy = 0;
    s.onGround = false;
    s.groundIndex = -1;
    for (let n = 0; n < 480; n++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    s.x = 9825;
    s.y = 1100;
    s.vx = 0;
    s.vy = 0;
    s.onGround = true;
  });
  await page.keyboard.press("e");
  const trials = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.clock += 1 / 120;
    s.step(1 / 120);
    return JSON.parse(localStorage.getItem("dewlight.save.v2")!).trials;
  });
  expect(trials).toEqual(
    expect.arrayContaining(["rise-1", "turn-1", "seal-1"]),
  );
  await expect(page.locator(".toast")).toContainText("获得一枚风语玻璃签");
  await page.reload();
  await page.getByRole("button", { name: "继续旅程" }).click();
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "背包", exact: true }).click();
  await expect(page.locator(".page-content")).toContainText("1 / 6 风语玻璃签");
});

for (const width of [1024, 1440])
  test(`banner leaves HUD and character space at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 768 });
    await page.goto("/");
    await page.getByRole("button", { name: "开启旅程" }).click();
    const box = await page.locator(".quest-banner").boundingBox();
    const hud = await page.locator(".hud").boundingBox();
    expect(box!.y).toBeGreaterThan(hud!.y + hud!.height);
    expect(box!.height).toBeLessThan(150);
    expect(box!.x).toBeGreaterThan(300);
  });
