import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.dewlight);
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 16 * 140;
    const c = canvas.getContext("2d");
    c.fillStyle = "#193540";
    c.fillRect(0, 0, canvas.width, canvas.height);
    const states = [
      "patrol",
      "windup",
      "strike",
      "recover",
      "hurt",
      "bound",
      "defeat",
      "idle",
    ];
    for (let type = 0; type < 2; type++)
      states.forEach((state, row) => {
        const y = (type * 8 + row) * 140;
        c.font = "14px sans-serif";
        c.fillStyle = "#e8dba7";
        c.fillText(
          `${type ? "GLASSWING" : "MOSSBACK"} / ${state.toUpperCase()}`,
          12,
          y + 18,
        );
        for (let f = 0; f < 8; f++) {
          const source = window.dewlight.textures
            .get(`creature-${type}-${state}-${f}`)
            .getSourceImage();
          c.drawImage(source, f * 160 + 3, y + 22, 154, 120);
        }
      });
    return canvas.toDataURL().split(",")[1];
  });
  mkdirSync("artifacts/motion", { recursive: true });
  writeFileSync(
    "artifacts/motion/creature-sheet.png",
    Buffer.from(data, "base64"),
  );
} finally {
  await browser.close();
}
