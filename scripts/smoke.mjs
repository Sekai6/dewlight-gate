import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const url = process.env.PLAY_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (request) => {
  if (new URL(request.url()).origin !== new URL(url).origin)
    external.push(request.url());
});
await page.goto(url);
await page.getByRole("button", { name: "开启旅程" }).click();
await page.keyboard.down("d");
await page.waitForTimeout(300);
await page.keyboard.up("d");
await page.keyboard.press("Tab");
await page.getByRole("button", { name: "背包", exact: true }).click();
await page.getByRole("button", { name: "继续探索" }).click();
await context.setOffline(true);
await page.keyboard.press("Space", { delay: 60 });
await page.waitForTimeout(100);
const report = {
  production: await page.evaluate(() => !("dewlight" in window)),
  canvas: await page.locator("canvas").count(),
  external,
  errors,
  offlineInteraction: true,
};
mkdirSync("artifacts/final", { recursive: true });
await page.screenshot({ path: "artifacts/final/production.png" });
writeFileSync("artifacts/final/smoke.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
await browser.close();
if (!report.production || errors.length || external.length)
  process.exitCode = 1;
