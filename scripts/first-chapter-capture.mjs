import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
const dir = "artifacts/first-chapter";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await page.getByRole("button", { name: "开启旅程" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}/opening.png` });
// Position for an encounter showcase; continuous no-teleport proof is guidance-route.mjs.
await page.evaluate(() => {
  const s = window.dewlight.scene.getScene("journey");
  for (const p of s.layout.prisms.filter((p) => p.room === 0))
    s.activatePrism(p);
  s.x = 2500;
  s.y = 1100;
  s.vx = 0;
  s.vy = 0;
  s.framing.reset();
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${dir}/guardian-intro.png` });
await page.waitForFunction(
  () => window.dewlight.scene.getScene("journey").guardian.phase === "warn",
);
await page.evaluate(() => window.dewlight.loop.sleep());
await page.screenshot({ path: `${dir}/charge-warning.png` });
await page.evaluate(() => window.dewlight.loop.wake());
await page.keyboard.press("Space");
await page.waitForTimeout(400);
await page.keyboard.down("d");
await page.waitForTimeout(600);
await page.keyboard.up("d");
await page.keyboard.press("k");
await page.keyboard.press("j");
await page.waitForTimeout(500);
await page.keyboard.press("Tab");
await page.screenshot({ path: `${dir}/journey.png` });
await page.setViewportSize({ width: 1024, height: 768 });
await page.keyboard.press("Tab");
await page.waitForTimeout(150);
await page.screenshot({ path: `${dir}/guardian-1024.png` });
const video = page.video();
await context.close();
renameSync(await video.path(), `${dir}/guardian-preview.webm`);
await browser.close();
writeFileSync(
  `${dir}/capture-report.json`,
  JSON.stringify({ errors, positionedShowcase: true }, null, 2),
);
if (errors.length) throw new Error(errors.join("\n"));
