import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://127.0.0.1:5173");
await p.getByRole("button", { name: "开启旅程" }).click();
await p.evaluate(() => {
  const s = window.dewlight.scene.getScene("journey");
  const e = s.enemies.find((e) => e.type === 1);
  s.x = e.x - 130;
  s.y = e.y + 30;
  s.vy = 0;
  e.bound = s.clock + 3;
});
await p.waitForTimeout(100);
await p.screenshot({ path: "artifacts/screens/creature.png" });
await p.evaluate(() => {
  const s = window.dewlight.scene.getScene("journey");
  const t = s.layout.stones[0];
  s.x = t.x - 90;
  s.y = t.y;
  s.vy = 0;
  s.effects.burst(t.x, t.y - 87, s.clock, "awaken", false);
});
await p.waitForTimeout(400);
await p.screenshot({ path: "artifacts/screens/monument.png" });
await b.close();
