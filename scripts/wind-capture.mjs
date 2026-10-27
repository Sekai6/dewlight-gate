import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("artifacts/wind", { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    recordVideo: {
      dir: "artifacts/wind/video",
      size: { width: 1440, height: 900 },
    },
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "开启旅程" }).click();
  for (const [name, x, y] of [
    ["updraft", 1750, 1000],
    ["tailwind", 3825, 1100],
    ["glasswind", 15825, 1100],
    ["canopywind", 27825, 1100],
  ]) {
    await page.evaluate(
      ({ x, y }) => {
        const s = window.dewlight.scene.getScene("journey");
        s.x = x;
        s.y = y;
        s.vx = 0;
        s.vy = 0;
        s.onGround = false;
      },
      { x, y },
    );
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `artifacts/wind/${name}.png` });
    if (name === "tailwind") {
      await page.keyboard.press("e");
      await page.waitForTimeout(1200);
      await page.screenshot({ path: "artifacts/wind/reversed.png" });
    }
  }
  const video = page.video();
  await context.close();
  await video.saveAs("artifacts/wind/wind-showcase.webm");
  writeFileSync(
    "artifacts/wind/report.json",
    JSON.stringify({ errors }, null, 2),
  );
} finally {
  await browser.close();
}
