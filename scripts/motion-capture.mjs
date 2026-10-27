import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("artifacts/motion", { recursive: true });
const b = await chromium.launch();
const context = await b.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: "artifacts/motion", size: { width: 1280, height: 800 } },
});
const p = await context.newPage();
await p.goto("http://127.0.0.1:5173");
await p.getByRole("button", { name: "开启旅程" }).click();
await p.keyboard.down("c");
await p.keyboard.down("d");
await p.waitForTimeout(450);
await p.screenshot({ path: "artifacts/motion/walk.png" });
await p.keyboard.up("c");
await p.waitForTimeout(250);
await p.screenshot({ path: "artifacts/motion/run.png" });
await p.keyboard.up("d");
await p.keyboard.down("d");
await p.waitForTimeout(600);
await p.keyboard.press("Space");
await p.waitForTimeout(350);
await p.keyboard.up("d");
await p.waitForTimeout(500);
await p.keyboard.press("j");
await p.waitForTimeout(130);
await p.evaluate(() => window.dewlight.loop.sleep());
await p.screenshot({ path: "artifacts/motion/attack.png" });
await p.evaluate(() => window.dewlight.loop.wake());
await p.waitForTimeout(400);
await p.keyboard.press("Shift");
await p.waitForTimeout(90);
await p.evaluate(() => window.dewlight.loop.sleep());
await p.screenshot({ path: "artifacts/motion/dash.png" });
await p.evaluate(() => window.dewlight.loop.wake());
await p.waitForTimeout(800);
await p.evaluate(() => {
  const s = window.dewlight.scene.getScene("journey");
  const e = s.enemies.find((e) => e.type === 0);
  s.x = e.x - 120;
  s.y = e.y;
  s.vy = 0;
  s.facing = 1;
});
await p.waitForTimeout(100);
await p.keyboard.press("k");
await p.waitForTimeout(100);
await p.evaluate(() => window.dewlight.loop.sleep());
await p.screenshot({ path: "artifacts/motion/bind.png" });
await p.evaluate(() => window.dewlight.loop.wake());
await p.waitForTimeout(1500);
const timing = await p.evaluate(async () => {
  const times = [];
  let prev = performance.now();
  for (let n = 0; n < 120; n++)
    await new Promise((resolve) =>
      requestAnimationFrame((t) => {
        times.push(t - prev);
        prev = t;
        resolve();
      }),
    );
  times.sort((a, b) => a - b);
  return {
    medianFrameMs: times[60],
    p95FrameMs: times[114],
    note: "Headless browser timing; not representative of all desktop GPUs.",
  };
});
writeFileSync("artifacts/motion/timing.json", JSON.stringify(timing, null, 2));
await context.close();
await b.close();
