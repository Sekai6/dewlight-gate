import { test, expect, chromium } from "@playwright/test";

test("浏览器失焦后暂停，焦点返回不会自动恢复", async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--window-position=-32000,-32000"],
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:5173");
    const cdp = await context.newCDPSession(page);
    // Control browser focus through CDP, not a synthetic DOM blur event.
    // Offscreen Windows Chromium can keep background tabs marked visible.
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await expect
      .poll(() => page.evaluate(() => document.hasFocus()))
      .toBe(true);
    await page.getByRole("button", { name: "开启旅程" }).click();
    const other = await context.newPage();
    await other.bringToFront();
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await expect
      .poll(() => page.evaluate(() => document.hasFocus()))
      .toBe(false);
    await page.bringToFront();
    await expect(
      page.getByRole("heading", { name: "暂停 · 旅程手记" }),
    ).toBeVisible();
    const before = await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").clock,
    );
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(
        () => (window as any).dewlight.scene.getScene("journey").clock,
      ),
    ).toBe(before);
  } finally {
    await browser.close();
  }
});

test("合成音效有实际非零音频，静音后不创建新音符", async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    (window as any).__audio = { starts: 0, peak: 0 };
    class MeasuredContext extends Original {
      override createOscillator() {
        const oscillator = super.createOscillator(),
          start = oscillator.start.bind(oscillator);
        oscillator.start = (...args: Parameters<OscillatorNode["start"]>) => {
          (window as any).__audio.starts++;
          return start(...args);
        };
        return oscillator;
      }
      override createGain() {
        const gain = super.createGain(),
          analyser = super.createAnalyser();
        gain.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const timer = setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          (window as any).__audio.peak = Math.max(
            (window as any).__audio.peak,
            ...samples.map(Math.abs),
          );
        }, 10);
        setTimeout(() => clearInterval(timer), 2000);
        return gain;
      }
    }
    window.AudioContext = MeasuredContext;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.waitForTimeout(500);
  const measured = await page.evaluate(() => (window as any).__audio);
  expect(measured.starts).toBeGreaterThan(0);
  expect(measured.peak).toBeGreaterThan(0.0001);
  await page.keyboard.press("Tab");
  await page.getByLabel("静音", { exact: true }).check();
  const before = await page.evaluate(() => (window as any).__audio.starts);
  await page.getByRole("button", { name: "继续探索" }).click();
  await page.keyboard.press("j", { delay: 80 });
  expect(await page.evaluate(() => (window as any).__audio.starts)).toBe(
    before,
  );
});

test("敌人掉落在刷新后再次击败也不重复计数", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  async function defeat() {
    return page.evaluate(() => {
      const game = (window as any).dewlight,
        s = game.scene.getScene("journey");
      game.loop.sleep();
      const e = s.enemies[0];
      s.x = e.x - 55;
      s.y = e.y;
      s.facing = 1;
      for (let attack = 0; attack < 2; attack++) {
        s.keys.J._justDown = true;
        for (let n = 0; n < 60; n++) {
          s.clock += 1 / 120;
          s.step(1 / 120);
        }
      }
      return { hp: e.hp, id: e.id };
    });
  }
  const first = await defeat();
  expect(first.hp).toBe(0);
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("dewlight.save.v2")!).beads,
  );
  await page.reload();
  await page.getByRole("button", { name: "继续旅程" }).click();
  const second = await defeat();
  expect(second.hp).toBe(0);
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("dewlight.save.v2")!).beads,
  );
  expect(after.filter((id: string) => id === first.id)).toHaveLength(1);
  expect(after.length).toBe(before.length);
});
