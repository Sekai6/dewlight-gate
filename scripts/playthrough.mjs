import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.PLAY_URL || "http://127.0.0.1:5173");
await page.getByRole("button", { name: "开启旅程" }).click();
const layout = await page.evaluate(
  () => window.dewlight.scene.getScene("journey").layout,
);
const goals = layout.routeGoals;
let target = 0,
  held = "",
  lastJump = 0,
  lastAttack = 0,
  lastBind = 0,
  lastE = 0;
const began = Date.now();
let lastProgress = began,
  lastX = 130,
  lastRoom = -1,
  complete = false;
mkdirSync("artifacts/playthrough", { recursive: true });
try {
  while (Date.now() - began < 20 * 60 * 1000) {
    const state = await page.evaluate(() => {
      const s = window.dewlight.scene.getScene("journey");
      return {
        x: s.x,
        y: s.y,
        ground: s.onGround,
        platform: s.layout.platforms[s.groundIndex],
        layout: s.layout,
        hp: s.hp,
        clock: s.clock,
        enemy: s.enemies.some(
          (e) =>
            e.hp > 0 && Math.abs(e.x - s.x) < 110 && Math.abs(e.y - s.y) < 100,
        ),
        end:
          document.querySelector(".overlay h1")?.textContent ===
          "清晨，为你醒来",
        paused: document.querySelector("#ui").dataset.mode === "pause",
      };
    });
    if (state.end) {
      complete = true;
      await page.screenshot({ path: "artifacts/playthrough/ending.png" });
      break;
    }
    if (state.paused) throw new Error("Journey unexpectedly paused");
    const g = goals[target];
    if (!g) throw new Error("Goals exhausted before ending");
    // An acknowledged ritual stays complete even when the moving landing shifts
    // or the player begins descending before the next observation.
    if (g.kind === "lens" && state.layout.lenses.includes(g.id)) {
      target++;
      continue;
    }

    if (g.room !== lastRoom) {
      lastRoom = g.room;
      console.log(
        `room ${g.room + 1}, wall ${Math.round((Date.now() - began) / 1000)}s, game ${state.clock.toFixed(1)}s, hp ${state.hp}`,
      );
      await page.screenshot({
        path: `artifacts/playthrough/room-${g.room + 1}.png`,
      });
    }
    const live = state.layout.platforms.find(
      (p) =>
        p.moving &&
        g.x >= p.x &&
        g.x <= p.x + p.w &&
        Math.abs(p.baseY - g.y) < 1,
    );
    const dx = g.x - state.x,
      dy = state.y - (live?.y ?? g.y),
      now = Date.now();
    const direction = dx > 12 ? "d" : dx < -12 ? "a" : "";
    if (direction !== held) {
      if (held) await page.keyboard.up(held);
      if (direction) await page.keyboard.down(direction);
      held = direction;
    }
    if (state.ground && Math.abs(dx) < 65 && dy < -20 && now - lastJump > 220) {
      await page.keyboard.down("s");
      await page.keyboard.press("Space", { delay: 30 });
      await page.keyboard.up("s");
      lastJump = now;
    }
    if (state.ground && state.platform && now - lastJump > 220) {
      const edge =
        dx > 0
          ? state.platform.x + state.platform.w - state.x
          : state.x - state.platform.x;
      if (
        (g.kind !== "drop" && dy > 12 && Math.abs(dx) < 180) ||
        (Math.abs(dx) > 90 && edge < 75)
      ) {
        await page.keyboard.press("Space", { delay: 30 });
        lastJump = now;
      }
    }
    if (Math.abs(dx) < 65 && Math.abs(dy) < 30 && state.ground) {
      if (g.kind === "lens") {
        if (state.layout.lenses.includes(g.id)) target++;
        else if (now - lastE > 180) {
          const prism = state.layout.prisms.find((p) => p.id === g.id);
          if (prism.mechanic === "hold" || prism.mechanic === "guard")
            await page.keyboard.press("k", { delay: 30 });
          await page.keyboard.press("e", { delay: 30 });
          lastE = now;
        }
      } else if (g.kind === "stone") {
        await page.keyboard.press("e", { delay: 30 });
        target++;
      } else target++;
    }
    if (state.enemy && now - lastAttack > 400) {
      await page.keyboard.press("j", { delay: 30 });
      lastAttack = now;
    }
    if (state.enemy && now - lastBind > 1600) {
      await page.keyboard.press("k", { delay: 30 });
      lastBind = now;
    }
    if (Math.abs(state.x - lastX) > 20) {
      lastProgress = now;
      lastX = state.x;
    }
    if (now - lastProgress > 20000)
      throw new Error(
        `Stuck at goal ${target}: ${JSON.stringify({ g, state: { x: state.x, y: state.y, platform: state.platform } })}`,
      );
    await page.waitForTimeout(60);
  }
} catch (e) {
  errors.push(String(e));
  await page.screenshot({ path: "artifacts/playthrough/failure.png" });
}
const saved = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("dewlight.save.v2") || "null"),
);
const report = {
  complete,
  wallSeconds: (Date.now() - began) / 1000,
  target,
  totalGoals: goals.length,
  errors,
  saved,
};
writeFileSync(
  "artifacts/playthrough/report.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({ complete, wallSeconds: report.wallSeconds, errors, target }),
);
await browser.close();
if (!complete) process.exitCode = 1;
