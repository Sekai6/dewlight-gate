import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
const width = Number(process.env.BOSS_CAPTURE_WIDTH || 1280);
const dir =
  width === 1024 ? "artifacts/boss-rework/1024" : "artifacts/boss-rework";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height: 800 },
  recordVideo: { dir, size: { width, height: 800 } },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const s = window.dewlight.scene.getScene("journey");
    for (const p of s.layout.prisms.filter((p) => p.room === 0))
      s.activatePrism(p);
    s.x = 2500;
    s.y = 1100;
    s.vx = 0;
    s.vy = 0;
    s.framing.reset();
  });
  const captured = new Set();
  let lastDirection = "",
    won = false;
  const start = Date.now();
  await page.keyboard.down("j");
  while (Date.now() - start < 45000) {
    const state = await page.evaluate(() => {
      const s = window.dewlight.scene.getScene("journey"),
        b = s.guardian;
      return {
        x: s.x,
        bx: b.x,
        phase: b.phase,
        age: s.clock - b.phaseAt,
        ground: s.onGround,
        hp: b.hp,
        playerHP: s.hp,
      };
    });
    const direction =
      state.bx - state.x > 78 ? "d" : state.bx - state.x < -78 ? "a" : "";
    if (direction !== lastDirection) {
      if (lastDirection) await page.keyboard.up(lastDirection);
      if (direction) await page.keyboard.down(direction);
      lastDirection = direction;
    }
    if (
      state.ground &&
      ((state.phase === "warn" && state.age > 0.65) ||
        (state.phase === "slam-warn" && state.age > 0.72))
    )
      await page.keyboard.press("Space");
    if (
      ["warn", "slam-warn", "slam", "recover", "defeated"].includes(
        state.phase,
      ) &&
      !captured.has(state.phase)
    ) {
      captured.add(state.phase);
      await page.screenshot({ path: `${dir}/${state.phase}.png` });
    }
    if (state.hp === 0) {
      won = true;
      break;
    }
    await page.waitForTimeout(65);
  }
  await page.keyboard.up("j");
  if (lastDirection) await page.keyboard.up(lastDirection);
  const report = {
    won,
    wallSeconds: (Date.now() - start) / 1000,
    errors,
    captured: [...captured],
    keyboardCombat: true,
    positionedEncounter: true,
  };
  writeFileSync(`${dir}/keyboard-report.json`, JSON.stringify(report, null, 2));
  if (!won || errors.length) throw new Error(JSON.stringify(report));
  await page.waitForTimeout(600);
} finally {
  const video = page.video();
  await context.close();
  renameSync(await video.path(), `${dir}/duel.webm`);
  await browser.close();
}
