import { chromium } from "@playwright/test";
for (const config of [
  { name: "new-headless", channel: "chromium", headless: true },
  {
    name: "headed",
    headless: false,
    args: ["--window-position=-32000,-32000"],
  },
  {
    name: "edge",
    channel: "msedge",
    headless: false,
    args: ["--window-position=-32000,-32000"],
  },
]) {
  let b;
  try {
    const { name, ...options } = config;
    b = await chromium.launch(options);
    const p = await b.newPage();
    await p.goto("http://127.0.0.1:5173");
    const support = await p.evaluate(async () => {
      const a = await navigator.gpu?.requestAdapter();
      return {
        gpu: !!navigator.gpu,
        adapter: !!a,
        info: a
          ? {
              vendor: a.info.vendor,
              architecture: a.info.architecture,
              device: a.info.device,
              description: a.info.description,
            }
          : null,
      };
    });
    console.log(JSON.stringify({ name, support }));
    if (support.adapter) {
      await p.selectOption("#quality", "webgpu");
      await p.waitForFunction(
        () => !document.querySelector("#quality")?.disabled,
      );
      console.log(await p.locator(".graphics-status").innerText());
      await p.screenshot({ path: `artifacts/screens/webgpu-${name}.png` });
    }
  } catch (e) {
    console.log(
      JSON.stringify({ name: config.name, error: String(e).slice(0, 250) }),
    );
  } finally {
    await b?.close();
  }
}
