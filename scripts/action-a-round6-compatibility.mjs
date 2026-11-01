import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const results = [];
for (const variant of ["before", "after"]) {
  const b = await chromium.launch();
  try {
    const page = await b.newPage();
    await page.goto(`http://127.0.0.1:${variant === "before" ? 5180 : 5173}`);
    await page.locator('[data-action="new"]').click();
    const data = await page.evaluate(() => {
      const g = window.dewlight,
        s = g.scene.getScene("journey");
      g.loop.sleep();
      const cases = [];
      for (const fps of [10, 20, 60])
        for (const facing of [-1, 1])
          for (const kind of ["ground", "flying", "charge", "wave"])
            for (const key of [null, "SPACE", "SHIFT"]) {
              s.resetAnimations();
              s.clearInput();
              s.clock = 20;
              s.effects.reset();
              s.x = 400;
              s.y = 1100;
              s.vx = 0;
              s.vy = 0;
              s.hp = 5;
              s.energy = 100;
              s.hurtAt = -999;
              s.dashAt = -999;
              s.bindAt = -999;
              s.attackAt = -999;
              s.facing = facing;
              s.onGround = true;
              s.groundIndex = 0;
              s.hitPause = 0;
              s.accumulator = 0;
              s.draw();
              s.damage(false, 1, {
                kind,
                sourceX: 350,
                sourceY: 1100,
                direction: 1,
                instance: `${fps}:${facing}:${kind}:${key}`,
              });
              let controlTick = -1;
              const path = [];
              for (let tick = 1; tick <= 300; tick++) {
                if (tick === 31 && key) s.pendingKeys.add(key);
                s.clock += 1 / 120;
                s.step(1 / 120);
                if (tick % (120 / fps) === 0) s.draw();
                if (controlTick < 0 && !s.doll.state.active) controlTick = tick;
                if (tick % 12 === 0)
                  path.push([
                    s.x,
                    s.y,
                    s.hp,
                    s.energy,
                    s.dashAt,
                    s.bindAt,
                    s.doll.state.phase,
                    s.doll.state.bounces,
                  ]);
              }
              cases.push({ fps, facing, kind, key, controlTick, path });
            }
      return cases;
    });
    results.push({ variant, cases: data });
  } finally {
    await b.close();
  }
}
let rootError = 0,
  timingError = 0;
const differences = [];
results[0].cases.forEach((before, i) => {
  const after = results[1].cases[i];
  timingError = Math.max(
    timingError,
    Math.abs(before.controlTick - after.controlTick),
  );
  before.path.forEach((point, j) => {
    const other = after.path[j];
    rootError = Math.max(
      rootError,
      Math.hypot(point[0] - other[0], point[1] - other[1]),
    );
    if (JSON.stringify(point.slice(2)) !== JSON.stringify(other.slice(2)))
      differences.push({ i, j });
  });
});
const report = {
  cases: results[0].cases.length,
  rootError,
  timingErrorTicks: timingError,
  resourcePhaseDifferences: differences,
  results,
};
writeFileSync(
  "artifacts/action-a-round6/compatibility.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    cases: report.cases,
    rootError,
    timingError,
    differences: differences.length,
  }),
);
if (rootError > 3 || timingError > 1 || differences.length)
  process.exitCode = 1;
