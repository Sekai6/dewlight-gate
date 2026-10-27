import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("artifacts/guidance", { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: "artifacts/guidance/video",
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/guidance/opening.png" });
  await page.keyboard.down("d");
  await page.waitForTimeout(1100);
  await page.keyboard.up("d");
  await page.keyboard.press("Space");
  await page.waitForTimeout(600);
  await page.waitForTimeout(4300);
  await page.screenshot({ path: "artifacts/guidance/compact.png" });
  await page.keyboard.press("Tab");
  await page.screenshot({ path: "artifacts/guidance/journal.png" });
  await page.keyboard.press("Tab");
  await page.evaluate(() => {
    const s = window.dewlight.scene.getScene("journey");
    s.x = 17400;
    s.y = 300;
    s.vx = 0;
    s.vy = 0;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "artifacts/guidance/reflect.png" });
  await page.keyboard.press("e");
  await page.waitForTimeout(450);
  const video = page.video();
  await context.close();
  await video.saveAs("artifacts/guidance/journey-guide.webm");
  writeFileSync(
    "artifacts/guidance/report.json",
    JSON.stringify({ errors, positionedMechanismReview: true }, null, 2),
  );
} finally {
  await browser.close();
}
