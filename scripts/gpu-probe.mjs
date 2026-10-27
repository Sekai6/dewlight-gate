import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  args:
    process.env.GPU_SOFTWARE === "1"
      ? ["--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader"]
      : [],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5173");
  await page.waitForSelector("#quality");
  const support = await page.evaluate(async () => ({
    secure: isSecureContext,
    gpu: !!navigator.gpu,
    adapter: !!(await navigator.gpu?.requestAdapter()),
  }));
  await page.selectOption("#quality", "webgpu");
  await page.waitForFunction(
    () => !document.querySelector("#quality")?.disabled,
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: "artifacts/screens/webgpu-probe.png" });
  console.log(
    JSON.stringify({
      support,
      quality: await page.locator("#quality").inputValue(),
      status: await page.locator(".graphics-status").innerText(),
      errors,
    }),
  );
} finally {
  await browser.close();
}
