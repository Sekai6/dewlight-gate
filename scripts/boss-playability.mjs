import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const browser = await chromium.launch();
const results = [];
try {
  for (const strategy of ["no-bind", "with-bind", "idle"]) {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:5173");
    await page.getByRole("button", { name: "开启旅程" }).click();
    const result = await page.evaluate((strategy) => {
      const g = window.dewlight,
        s = g.scene.getScene("journey");
      g.loop.sleep();
      // Isolate the encounter; only normal controls are used after this setup.
      for (const p of s.layout.prisms.filter((p) => p.room === 0))
        s.activatePrism(p);
      s.x = 2500;
      s.y = 1100;
      s.vx = 0;
      s.vy = 0;
      const phases = new Set();
      let damage = 0,
        retries = 0,
        lastHP = 5;
      for (let n = 0; n < 120 * 100; n++) {
        const b = s.guardian,
          dx = b.x - s.x;
        phases.add(b.phase);
        if (strategy !== "idle") {
          s.keys.A.isDown = dx < -78;
          s.keys.D.isDown = dx > 78;
          s.facing = dx > 0 ? 1 : -1;
          s.keys.J.isDown = true;
          const age = s.clock - b.phaseAt;
          if (
            ((b.phase === "warn" && age > 0.65) ||
              (b.phase === "slam-warn" && age > 0.72)) &&
            s.onGround
          )
            s.keys.SPACE._justDown = true;
          if (strategy === "with-bind" && n % 180 === 0)
            s.keys.K._justDown = true;
        }
        s.clock += 1 / 120;
        s.step(1 / 120);
        if (s.hp < lastHP) damage += lastHP - s.hp;
        if (s.guardian !== b) {
          retries++;
          break;
        }
        lastHP = s.hp;
        if (s.guardian.hp === 0) break;
      }
      return {
        strategy,
        won: s.guardian.hp === 0,
        seconds: s.clock,
        damage,
        retries,
        remainingHP: s.hp,
        bossHP: s.guardian.hp,
        phases: [...phases],
      };
    }, strategy);
    results.push(result);
    await page.close();
  }
} finally {
  await browser.close();
}
mkdirSync("artifacts/boss-rework", { recursive: true });
writeFileSync(
  "artifacts/boss-rework/playability.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
if (
  results.some((r) => r.strategy !== "idle" && !r.won) ||
  !results.find((r) => r.strategy === "no-bind").phases.includes("slam") ||
  results.find((r) => r.strategy === "idle").damage === 0
)
  throw new Error("Boss playability checks failed");
