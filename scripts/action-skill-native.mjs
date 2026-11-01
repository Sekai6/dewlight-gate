import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ channel: "chromium" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.skillGpuSubmissions = 0;
    if (!navigator.gpu) return;
    const request = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = async (options) => {
      const adapter = await request(options);
      if (adapter) {
        const device = adapter.requestDevice.bind(adapter);
        adapter.requestDevice = async (descriptor) => {
          const d = await device(descriptor),
            submit = d.queue.submit.bind(d.queue);
          d.queue.submit = (buffers) => {
            window.skillGpuSubmissions++;
            submit(buffers);
          };
          return d;
        };
      }
      return adapter;
    };
  });
  await page.goto("http://127.0.0.1:5173");
  const adapter = await page.evaluate(async () => {
    const a = await navigator.gpu?.requestAdapter();
    return a
      ? {
          vendor: a.info.vendor,
          architecture: a.info.architecture,
          device: a.info.device,
          description: a.info.description,
        }
      : null;
  });
  let result;
  if (!adapter)
    result = {
      status: "skipped",
      reason: "Native Chromium returned no WebGPU adapter",
      errors,
    };
  else {
    await page.locator("#quality").selectOption("webgpu");
    await page.waitForFunction(() => document.querySelector("#webgpu-view"));
    await page.locator('[data-action="new"]').click();
    const before = await page.evaluate(() => window.skillGpuSubmissions);
    await page.keyboard.press("q");
    await page.waitForTimeout(170);
    await page.keyboard.press("r");
    await page.waitForTimeout(350);
    await page.keyboard.press("f");
    await page.waitForTimeout(180);
    await page.screenshot({ path: "artifacts/action-skill/webgpu-skills.png" });
    result = await page.evaluate(() => {
      const s = window.dewlight.scene.getScene("journey");
      return {
        status: "executed",
        submissions: window.skillGpuSubmissions,
        active: s.skills.active?.skill,
        energy: s.energy,
        canvas: !!document.querySelector("#webgpu-view"),
      };
    });
    Object.assign(result, { before, adapter, errors });
    if (
      !result.canvas ||
      result.submissions <= before ||
      result.active !== "bloom" ||
      errors.length
    )
      throw new Error(JSON.stringify(result));
  }
  writeFileSync(
    "artifacts/action-skill/webgpu.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
