import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate((full) => {
    const game = window.dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    let jumps = 0;
    let firstClearSeconds = 0;
    const trace = [];
    let lastLand = -1;
    for (let frame = 0; frame < (full ? 216000 : 24000); frame++) {
      if (
        !firstClearSeconds &&
        JSON.parse(localStorage.getItem("dewlight.save.v2"))?.stones.includes(0)
      )
        firstClearSeconds = s.clock;
      if (
        (!full &&
          s.layout.lenses.filter((id) => id.startsWith("lens-0-")).length ===
            4) ||
        (full &&
          frame % 120 === 0 &&
          JSON.parse(localStorage.getItem("dewlight.save.v2")).stones.length ===
            3)
      )
        return {
          complete: true,
          seconds: s.clock,
          jumps,
          lenses: s.layout.lenses,
          stones: JSON.parse(localStorage.getItem("dewlight.save.v2")).stones,
          firstClearSeconds,
          guardianDefeated: s.guardian.hp === 0,
        };
      if (s.onGround && s.groundIndex !== lastLand) {
        lastLand = s.groundIndex;
        trace.push({ x: s.x, y: s.y, g: s.groundIndex, p: s.nextGuideStep });
        if (trace.length > 12) trace.shift();
      }
      const goal = s.guideObjective,
        point = s.nextGuideStep,
        dx = point.x - s.x;
      s.keys.A.isDown = dx < -10;
      s.keys.D.isDown = dx > 10;
      s.keys.S.isDown = !s.onGround && point.y > s.y + 35;
      if (goal.id === "guardian") {
        const b = s.guardian;
        s.facing = b.x > s.x ? 1 : -1;
        const gap = Math.abs(b.x - s.x);
        s.keys.A.isDown = b.x < s.x && gap > 65;
        s.keys.D.isDown = b.x > s.x && gap > 65;
        if ((b.phase === "warn" || b.phase === "slam-warn") && s.onGround)
          s.keys.SPACE._justDown = true;
        if (frame % 48 === 0) s.keys.J._justDown = true;
        if (frame % 200 === 0) s.keys.K._justDown = true;
      }
      if (s.onGround && point.action.includes("\u7a7a\u683c")) {
        const floor = s.layout.platforms[s.groundIndex];
        const overlap =
          floor && point.x >= floor.x + 15 && point.x <= floor.x + floor.w - 15;
        const edge = floor
          ? dx > 0
            ? floor.x + floor.w - s.x
            : s.x - floor.x
          : 0;
        const drop = point.action.includes("\u7a7f\u4e0b");
        if (
          (drop && Math.abs(dx) < 65) ||
          (!drop && ((overlap && Math.abs(dx) < 65) || (!overlap && edge < 25)))
        ) {
          s.keys.S.isDown = drop;
          s.keys.SPACE._justDown = true;
          jumps++;
        }
      }
      if (
        Math.abs(goal.x - s.x) < 70 &&
        Math.abs(goal.y - s.y) < 65 &&
        frame % 25 === 0
      )
        s.keys.E._justDown = true;
      if (
        full &&
        Math.abs(goal.x - s.x) < 180 &&
        Math.abs(goal.y - s.y) < 100
      ) {
        if (frame % 65 === 0 && s.energy >= 25) s.keys.K._justDown = true;
        if (frame % 50 === 0) s.keys.J._justDown = true;
        const enemy = s.enemies.find(
          (e) =>
            e.hp > 0 &&
            Math.abs(e.x - s.x) < 170 &&
            Math.abs(e.y - s.y + 30) < 100,
        );
        if (enemy) s.facing = enemy.x > s.x ? 1 : -1;
      }
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    return {
      complete: false,
      trace,
      ground: s.groundIndex,
      onGround: s.onGround,
      vy: s.vy,
      groundPlatform: s.layout.platforms[s.groundIndex],
      x: s.x,
      y: s.y,
      seconds: s.clock,
      point: s.nextGuideStep,
      objective: s.guideObjective,
      lenses: s.layout.lenses,
    };
  }, process.env.GUIDE_FULL === "1");
  mkdirSync("artifacts/guidance", { recursive: true });
  writeFileSync(
    process.env.GUIDE_FULL === "1"
      ? "artifacts/guidance/route-report.json"
      : "artifacts/guidance/intro-route-report.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  if (!result.complete)
    throw new Error(
      "Guidance route did not complete; inspect the saved report.",
    );
} finally {
  await browser.close();
}
