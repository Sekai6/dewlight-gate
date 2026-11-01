import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const results = [];
for (const port of [5181, 5173]) {
  const browser = await chromium.launch();
  try {
    const cases = [];
    for (const scenario of ["combo", "moss", "moth", "guardian"]) {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}`);
      await page.locator('[data-action="new"]').click();
      await page.evaluate((scenario) => {
        const g = window.dewlight,
          s = g.scene.getScene("journey");
        g.loop.sleep();
        s.clock = 20;
        s.resetAnimations();
        s.clearInput();
        s.hp = 5;
        s.energy = 100;
        s.vx = s.vy = 0;
        s.facing = 1;
        s.hurtAt = -999;
        s.attackAt = s.dashAt = s.bindAt = -999;
        if (scenario === "guardian") {
          for (const p of s.layout.prisms.filter((p) => p.room === 0))
            s.activatePrism(p);
          s.x = 2700;
          s.y = 1100;
          const b = s.guardian;
          b.x = 2850;
          b.phase = "stalk";
          b.phaseAt = s.clock;
          b.until = s.clock + 0.3;
          b.hp = 36;
          b.wave = [];
        } else {
          const e = s.enemies.find(
            (e) => e.type === (scenario === "moth" ? 1 : 0),
          );
          s.x = e.x - (scenario === "combo" ? 55 : 110);
          s.y = e.floor;
          e.hp = 2;
          e.phase = "patrol";
          e.phaseAt = s.clock;
          e.cool = s.clock + 0.1;
          e.hurtAt = -999;
          e.bound = 0;
        }
        s.safe = { x: s.x, y: s.y };
        s.draw();
      }, scenario);
      if (scenario === "combo") await page.keyboard.down("j");
      const trace = await page.evaluate(() => {
        const s = window.dewlight.scene.getScene("journey"),
          out = [];
        for (let tick = 0; tick < 720; tick++) {
          s.clock += 1 / 120;
          s.step(1 / 120);
          s.draw();
          out.push({
            tick,
            x: s.x,
            y: s.y,
            hp: s.hp,
            energy: s.energy,
            attack: s.attackAt,
            dash: s.dashAt,
            bind: s.bindAt,
            hold: s.hitPause,
            enemies: s.enemies.map((e) => [e.hp, e.phase, e.phaseAt, e.warn]),
            boss: [
              s.guardian.hp,
              s.guardian.phase,
              s.guardian.phaseAt,
              s.guardian.wave.length,
            ],
          });
        }
        return out;
      });
      cases.push({ scenario, trace });
      await page.close();
    }
    results.push({ port, cases });
  } finally {
    await browser.close();
  }
}
let differences = 0;
for (let i = 0; i < results[0].cases.length; i++)
  for (let j = 0; j < 720; j++)
    if (
      JSON.stringify(results[0].cases[i].trace[j]) !==
      JSON.stringify(results[1].cases[i].trace[j])
    )
      differences++;
writeFileSync(
  "artifacts/action-a-round7/combat-compatibility.json",
  JSON.stringify({ differences, results }, null, 2),
);
console.log(
  JSON.stringify({ scenarios: 4, ticksPerScenario: 720, differences }),
);
if (differences) process.exitCode = 1;
