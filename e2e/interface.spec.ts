import { test, expect } from "@playwright/test";
for (const viewport of [
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 640, height: 800 },
]) {
  test(`界面可读与菜单完整 ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "开启旅程" })).toBeVisible();
    if (viewport.width < 760)
      await expect(page.locator(".smallwarn")).toBeVisible();
    await page.getByRole("button", { name: "开启旅程" }).click();
    await page.keyboard.press("Tab");
    await expect(page.locator(".map-node")).toHaveCount(6);
    await expect(page.locator(".map-node.current")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "继续探索" }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "操作", exact: true }).click();
    await expect(page.locator(".panel")).toContainText("束缚");
    await expect(
      page.getByRole("button", { name: "继续探索" }),
    ).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    await page.screenshot({ path: `test-results/menu-${viewport.width}.png` });
  });
}
test("音量、静音和减少动态设置保持，并且标题说明不开始游戏", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("静音", { exact: true }).check();
  await page.getByLabel("减少动态效果", { exact: true }).check();
  await page.getByLabel("音量", { exact: true }).fill("0.7");
  await page.getByRole("button", { name: "操作说明", exact: true }).click();
  await expect(page.getByLabel("静音", { exact: true })).toBeChecked();
  await expect(page.getByLabel("减少动态效果", { exact: true })).toBeChecked();
  await expect(page.getByLabel("音量", { exact: true })).toHaveValue("0.7");
  const clock = await page.evaluate(
    () => (window as any).dewlight.scene.getScene("journey").clock,
  );
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").clock,
    ),
  ).toBe(clock);
});
test("两倍像素密度使用双倍画布，界面与游戏仍匹配窗口", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const size = await page
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => ({
      width: canvas.width,
      height: canvas.height,
      css: canvas.getBoundingClientRect().width,
    }));
  expect(size).toEqual({ width: 2560, height: 1600, css: 1280 });
  await page.screenshot({ path: "test-results/high-dpi.png" });
  await context.close();
});
