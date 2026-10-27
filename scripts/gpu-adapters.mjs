import { chromium } from "@playwright/test";
const cases = [
  ["unsafe", ["--enable-unsafe-webgpu"]],
  [
    "vulkan",
    [
      "--enable-unsafe-webgpu",
      "--enable-features=Vulkan",
      "--use-angle=vulkan",
      "--use-vulkan=swiftshader",
      "--disable-vulkan-surface",
    ],
  ],
  [
    "swiftshader",
    [
      "--enable-unsafe-webgpu",
      "--use-angle=swiftshader",
      "--use-webgpu-adapter=swiftshader",
    ],
  ],
];
for (const [name, args] of cases) {
  const b = await chromium.launch({ args });
  try {
    const p = await b.newPage();
    await p.goto("http://127.0.0.1:5173");
    const adapters = await p.evaluate(async () => {
      const result = [];
      for (const forceFallbackAdapter of [false, true]) {
        try {
          const a = await navigator.gpu?.requestAdapter({
            forceFallbackAdapter,
          });
          result.push({ forceFallbackAdapter, available: !!a, info: a?.info });
        } catch (e) {
          result.push({ error: String(e) });
        }
      }
      return result;
    });
    console.log(JSON.stringify({ name, adapters }));
  } finally {
    await b.close();
  }
}
