import { chromium } from "@playwright/test";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";

// Positioned encounters verify animation and real keyboard combat, not the full route.
const quality =
  process.env.COMBAT_QUALITY ??
  (process.env.COMBAT_GPU === "1" ? "webgpu" : "dream");
const gpu = quality === "webgpu";
const dir = gpu
  ? "artifacts/combat-webgpu"
  : quality === "soft"
    ? "artifacts/combat-soft"
    : "artifacts/combat";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  channel: gpu ? "chromium" : undefined,
});
const report = [];
try {
  for (const type of [0, 1]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir,
        size: { width: 1440, height: 900 },
      },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5173");
    await page.getByLabel("画质", { exact: true }).selectOption(quality);
    await page.waitForFunction(
      () => !document.querySelector("#quality")?.disabled,
    );
    if (
      (await page.getByLabel("画质", { exact: true }).inputValue()) !== quality
    )
      throw new Error("Requested quality unavailable");
    await page.getByRole("button", { name: "开启旅程" }).click();
    const index = await page.evaluate((type) => {
      const s = window.dewlight.scene.getScene("journey");
      const i = s.enemies.findIndex((e) => e.type === type);
      const e = s.enemies[i];
      s.x = e.x - 80;
      s.y = e.floor;
      s.vx = 0;
      s.vy = 0;
      s.facing = 1;
      return i;
    }, type);
    const capture = async (name) => {
      await page.evaluate(() => window.dewlight.loop.sleep());
      await page.screenshot({ path: `${dir}/${type}-${name}.png` });
      const state = await page.evaluate((index) => {
        const s = window.dewlight.scene.getScene("journey"),
          e = s.enemies[index];
        return {
          clock: s.clock,
          hp: e.hp,
          phase: e.phase,
          warn: e.warn,
          bound: e.bound > s.clock,
          playerHP: s.hp,
        };
      }, index);
      report.push({ type, name, ...state });
      await page.evaluate(() => window.dewlight.loop.wake());
    };
    await page.waitForFunction(
      (index) =>
        window.dewlight.scene.getScene("journey").enemies[index].phase ===
        "windup",
      index,
    );
    await page.waitForTimeout(180);
    await capture("warning");
    await page.keyboard.press("Shift");
    await page.waitForFunction(
      (index) =>
        window.dewlight.scene.getScene("journey").enemies[index].phase ===
        "strike",
      index,
    );
    await capture("strike-dodged");
    await page.waitForTimeout(260);
    const dodgeHP = await page.evaluate((index) => {
      const s = window.dewlight.scene.getScene("journey"),
        e = s.enemies[index];
      const hp = s.hp;
      s.x = e.x - 80;
      s.y = e.floor;
      s.vx = 0;
      s.vy = 0;
      s.facing = 1;
      return hp;
    }, index);
    report.push({ type, dodgeHP });
    if (dodgeHP !== 5) throw new Error(`Dodge failed for creature ${type}`);
    await page.keyboard.press("k");
    await page.waitForFunction((index) => {
      const s = window.dewlight.scene.getScene("journey");
      return s.enemies[index].bound > s.clock;
    }, index);
    await capture("bound");
    await page.keyboard.press("j");
    await page.waitForTimeout(130);
    await capture("impact");
    await page.waitForTimeout(320);
    await page.keyboard.press("j");
    await page.waitForFunction(
      (index) =>
        window.dewlight.scene.getScene("journey").enemies[index].hp === 0,
      index,
    );
    await capture("defeat");
    await page.waitForTimeout(900);
    report.push({
      type,
      errors,
      quality,
      webgpu: (await page.locator("#webgpu-view").count()) === 1,
    });
    const video = page.video();
    await context.close();
    renameSync(
      await video.path(),
      `${dir}/${type ? "glasswing" : "mossback"}.webm`,
    );
  }
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
