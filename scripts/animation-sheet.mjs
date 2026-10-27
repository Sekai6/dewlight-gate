import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.dewlight);
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1440;
    canvas.height = 2160;
    const c = canvas.getContext("2d");
    c.fillStyle = "#183941";
    c.fillRect(0, 0, canvas.width, canvas.height);
    const names = [
      "IDLE",
      "WALK",
      "RUN",
      "JUMP / FALL",
      "ATTACK",
      "VINE CAST",
      "DASH",
      "HURT",
      "RISING CUT",
      "LAND / RECOVER",
      "TAKEOFF",
      "RUNNING CUT",
      "RUNNING RISING CUT",
      "TURN / PIVOT",
      "BRAKE / SETTLE",
    ];
    for (let a = 0; a < names.length; a++) {
      c.fillStyle = "#efdfb1";
      c.font = "14px sans-serif";
      c.fillText(names[a], 10, a * 144 + 18);
      for (let f = 0; f < 12; f++) {
        const source = window.dewlight.textures
          .get(`hero-${a * 12 + f}`)
          .getSourceImage();
        c.drawImage(source, f * 120 - 4, a * 144 + 20, 144, 128);
      }
    }
    return canvas.toDataURL().split(",")[1];
  });
  mkdirSync("artifacts/motion", { recursive: true });
  writeFileSync(
    "artifacts/motion/animation-sheet.png",
    Buffer.from(data, "base64"),
  );
} finally {
  await browser.close();
}
