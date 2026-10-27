import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const quality = process.env.PERF_QUALITY || "dream";
const b = await chromium.launch({
  channel: process.env.PERF_NATIVE === "1" ? "chromium" : undefined,
});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const encounter = process.env.PERF_ENCOUNTER === "1";
await p.goto("http://127.0.0.1:5173");
await p.getByLabel("画质", { exact: true }).selectOption(quality);
await p.waitForFunction(() => !document.querySelector("#quality")?.disabled);
if ((await p.getByLabel("画质", { exact: true }).inputValue()) !== quality)
  throw new Error(`Could not activate ${quality}`);
await p.getByRole("button", { name: "开启旅程" }).click();
if (encounter)
  await p.evaluate(() => {
    const s = window.dewlight.scene.getScene("journey"),
      e = s.enemies.find((e) => e.type === 1);
    s.x = e.x - 130;
    s.y = e.floor;
    s.vy = 0;
  });
await p.waitForTimeout(1000);
const report = await p.evaluate(async (encounter) => {
  const values = [];
  let previous = performance.now();
  for (let n = 0; n < 180; n++)
    await new Promise((resolve) =>
      requestAnimationFrame((time) => {
        values.push(time - previous);
        previous = time;
        resolve();
      }),
    );
  values.sort((a, b) => a - b);
  const game = window.dewlight;
  return {
    viewport: [innerWidth, innerHeight],
    dpr: devicePixelRatio,
    renderer: game.renderer.type,
    medianMs: values[90],
    p95Ms: values[171],
    frames: 180,
    recordVideo: false,
    quality: localStorage.getItem("dewlight.graphics.v1"),
    webgpuActive: !!document.querySelector("#webgpu-view"),
    scenario: encounter ? "glasswing encounter" : "safe opening",
    note: "Isolated headless Chromium on this machine; not a guarantee for other hardware.",
  };
}, encounter);
writeFileSync(
  `artifacts/motion/${quality}-${encounter ? "encounter" : "isolated"}-timing.json`,
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
await b.close();
