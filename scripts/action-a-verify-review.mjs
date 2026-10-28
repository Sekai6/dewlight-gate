import { chromium, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
const root = process.env.ACTION_A_OUTPUT || "artifacts/action-a-round2";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [],
    bad = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push(r.url());
  });
  await page.goto(`http://127.0.0.1:5173/${root}/review.html`);
  await page.waitForFunction(() =>
    [...document.querySelectorAll("video")].every((v) => v.readyState >= 1),
  );
  const metadata = await page.locator("video").evaluateAll((videos) =>
    videos.map((v) => ({
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
    })),
  );
  for (const video of metadata) {
    expect(video.duration).toBeCloseTo(24, 1);
    expect(video.width).toBe(1280);
    expect(video.height).toBe(800);
  }
  await page.locator("#rate").selectOption("0.25");
  await page.locator("#play").click();
  await page.waitForTimeout(1000);
  const playback = await page.locator("video").evaluateAll((videos) =>
    videos.map((v) => ({
      time: v.currentTime,
      rate: v.playbackRate,
      paused: v.paused,
    })),
  );
  expect(
    playback.every((v) => v.rate === 0.25 && !v.paused && v.time > 0.1),
  ).toBe(true);
  expect(Math.abs(playback[0].time - playback[1].time)).toBeLessThan(0.08);
  await page.locator("#play").click();
  expect(
    await page
      .locator("video")
      .evaluateAll((videos) => videos.every((v) => v.paused)),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(bad).toEqual([]);
  const report = { metadata, playback, errors, bad };
  writeFileSync(
    `${root}/review-verification.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
