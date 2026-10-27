import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
// Visual inspection only. These positioned screenshots are never route evidence.
mkdirSync("artifacts/screens", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:5173");
await page.screenshot({ path: "artifacts/screens/title.png" });
await page.getByRole("button", { name: "开启旅程" }).click();
for (let region = 0; region < 3; region++) {
  await page.evaluate((region) => {
    const s = window.dewlight.scene.getScene("journey");
    const p = s.layout.platforms.find(
      (p) =>
        p.room === region * 2 &&
        p.x >= region * 12000 + 500 &&
        p.y > 450 &&
        p.y < 600,
    );
    s.x = p.x + 80;
    s.y = p.y;
    s.vy = 0;
  }, region);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `artifacts/screens/region-${region + 1}.png` });
}
await page.keyboard.press("Tab");
await page.screenshot({ path: "artifacts/screens/journey.png" });
await browser.close();
