import { chromium, expect, test } from "@playwright/test";

test("画质选择保存，WebGPU 不可用时恢复兼容画面", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  await page.getByLabel("画质", { exact: true }).selectOption("soft");
  await page.reload();
  await expect(page.getByLabel("画质", { exact: true })).toHaveValue("soft");
  await page.getByLabel("画质", { exact: true }).selectOption("webgpu");
  await expect(page.getByLabel("画质", { exact: true })).toHaveValue("dream");
  await expect(page.locator("#webgpu-view")).toHaveCount(0);
  await expect(page.locator(".toast")).toContainText("无法启用 WebGPU");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const before = await page.evaluate(
    () => (window as any).dewlight.scene.getScene("journey").x,
  );
  await page.keyboard.down("d");
  await page.waitForTimeout(180);
  await page.keyboard.up("d");
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").x,
    ),
  ).toBeGreaterThan(before + 20);
});

test("真实 WebGPU 提交、跨地区、缩放和设备丢失回退", async ({}, testInfo) => {
  test.setTimeout(60000);
  // Full Chromium uses the native graphics stack; headless-shell has no adapter here.
  const browser = await chromium.launch({ channel: "chromium" });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      if (!navigator.gpu) return;
      const requestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
      navigator.gpu.requestAdapter = async (options) => {
        const adapter = await requestAdapter(options);
        if (adapter) {
          const requestDevice = adapter.requestDevice.bind(adapter);
          adapter.requestDevice = async (descriptor) => {
            const device = await requestDevice(descriptor);
            (window as any).__gpuDevice = device;
            (window as any).__gpuSubmissions = 0;
            (window as any).__dreamInstances = 0;
            (window as any).__dreamPasses = 0;
            const createEncoder = device.createCommandEncoder.bind(device);
            device.createCommandEncoder = (descriptor) => {
              const encoder = createEncoder(descriptor);
              const begin = encoder.beginRenderPass.bind(encoder);
              encoder.beginRenderPass = (descriptor) => {
                (window as any).__dreamPasses++;
                const pass = begin(descriptor),
                  draw = pass.draw.bind(pass);
                pass.draw = (
                  vertices,
                  instances,
                  firstVertex,
                  firstInstance,
                ) => {
                  if (instances === 768) (window as any).__dreamInstances++;
                  draw(vertices, instances, firstVertex, firstInstance);
                };
                return pass;
              };
              return encoder;
            };
            const submit = device.queue.submit.bind(device.queue);
            device.queue.submit = (buffers) => {
              (window as any).__gpuSubmissions++;
              submit(buffers);
            };
            return device;
          };
        }
        return adapter;
      };
    });
    await page.goto("http://127.0.0.1:5173");
    const adapter = await page.evaluate(async () => {
      const a = await navigator.gpu?.requestAdapter();
      return a
        ? { vendor: a.info.vendor, architecture: a.info.architecture }
        : null;
    });
    test.skip(
      !adapter,
      "此环境没有原生 WebGPU 适配器；兼容回退由另一项测试覆盖。",
    );
    await testInfo.attach("native-adapter", {
      body: JSON.stringify(adapter),
      contentType: "application/json",
    });
    await page.getByLabel("画质", { exact: true }).selectOption("webgpu");
    await expect(page.locator(".graphics-status")).toContainText(
      "WebGPU 光影已启用",
    );
    await expect
      .poll(() => page.evaluate(() => (window as any).__gpuSubmissions))
      .toBeGreaterThan(2);
    const rendered = await page.evaluate(() => ({
      instances: (window as any).__dreamInstances,
      passes: (window as any).__dreamPasses,
      submissions: (window as any).__gpuSubmissions,
    }));
    expect(rendered.instances).toBeGreaterThan(2);
    expect(rendered.passes).toBeGreaterThanOrEqual(rendered.submissions * 7);
    await expect(page.locator("#webgpu-view")).toHaveCount(1);
    await page.getByRole("button", { name: "开启旅程" }).click();
    for (const region of [0, 1, 2]) {
      await page.evaluate((region) => {
        const s = (window as any).dewlight.scene.getScene("journey");
        const p = s.layout.platforms.find(
          (p: any) =>
            p.room === region * 2 &&
            (region === 0 ? p.y === 940 : p.y > 450 && p.y < 600),
        );
        s.x = p.x + 80;
        s.y = p.y;
        s.vy = 0;
      }, region);
      await page.waitForTimeout(150);
      await page.screenshot({
        path: `artifacts/screens/webgpu-region-${region + 1}.png`,
      });
    }
    await page.keyboard.press("Tab");
    await page.waitForTimeout(120);
    const pausedPixels = await page.locator("#webgpu-view").screenshot();
    await page.waitForTimeout(250);
    expect(await page.locator("#webgpu-view").screenshot()).toEqual(
      pausedPixels,
    );
    await page.getByRole("button", { name: "继续探索" }).click();
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(200);
    const output = await page
      .locator("#webgpu-view")
      .evaluate((c: HTMLCanvasElement) => ({
        width: c.width,
        height: c.height,
      }));
    expect(output.width).toBeLessThanOrEqual(2560);
    expect(output.height).toBeLessThanOrEqual(1440);
    expect(output.width / output.height).toBeCloseTo(1.5, 2);
    await page.evaluate(() => (window as any).__gpuDevice.destroy());
    await expect(page.locator("#webgpu-view")).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("画质", { exact: true })).toHaveValue("dream");
    await expect(page.locator("#game > canvas")).toHaveCSS("opacity", "1");
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
