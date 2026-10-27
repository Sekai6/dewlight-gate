import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("artifacts/experience", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await page.getByRole("button", { name: "开启旅程" }).click();
await page.waitForTimeout(500);
const sheet = await page.evaluate(() => {
  const scene = window.dewlight.scene.getScene("journey");
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 650;
  const c = canvas.getContext("2d");
  c.fillStyle = "#16383e";
  c.fillRect(0, 0, canvas.width, canvas.height);
  const actions = [
    [1, "WALK"],
    [2, "RUN"],
    [4, "CUT"],
    [8, "RISING CUT"],
    [6, "DASH"],
  ];
  actions.forEach(([action, label], row) => {
    c.fillStyle = "#f7e7bc";
    c.font = "14px sans-serif";
    c.fillText(label, 16, row * 130 + 22);
    for (let n = 0; n < 8; n++) {
      const frame = action * 12 + Math.floor((n * 12) / 8);
      const source = scene.textures.get(`hero-${frame}`).getSourceImage();
      c.drawImage(source, 100 + n * 135, row * 130 + 12, 144, 128);
    }
  });
  return canvas.toDataURL("image/png").split(",")[1];
});
writeFileSync(
  "artifacts/experience/hero-actions.png",
  Buffer.from(sheet, "base64"),
);
await page.evaluate(() => {
  const s = window.dewlight.scene.getScene("journey");
  s.beads = [{ id: "capture-receipt", x: s.x + 55, y: s.y - 28 }];
});
await page.waitForTimeout(150);
await page.screenshot({ path: "artifacts/experience/collection.png" });
await page.keyboard.press("Tab");
await page.getByLabel("清晰界面").check();
await page.setViewportSize({ width: 1024, height: 768 });
await page.screenshot({ path: "artifacts/experience/settings-1024.png" });
await page.reload();
await page.screenshot({ path: "artifacts/experience/continue.png" });
writeFileSync(
  "artifacts/experience/capture-report.json",
  JSON.stringify({ errors }, null, 2),
);
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
