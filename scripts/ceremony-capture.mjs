import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const dir = "artifacts/ceremony";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const report = {
  positionedInteraction: true,
  routeEvidence: false,
  errors: [],
  shots: [],
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "开启旅程" }).click();
  for (let region = 0; region < 3; region++) {
    await page.evaluate((region) => {
      const s = window.dewlight.scene.getScene("journey"),
        t = s.layout.stones[region];
      s.x = t.x - 65;
      s.y = t.y;
      s.vx = 0;
      s.vy = 0;
      s.framing.reset();
    }, region);
    await page.waitForTimeout(160);
    await page.screenshot({ path: `${dir}/stone-${region + 1}-before.png` });
    await page.keyboard.press("e");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${dir}/stone-${region + 1}-awaken.png` });
    report.shots.push(
      await page.evaluate((region) => {
        const s = window.dewlight.scene.getScene("journey");
        return { region, zoom: s.cameras.main.zoom, clock: s.clock };
      }, region),
    );
    if (region < 2) await page.waitForTimeout(2500);
  }
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
