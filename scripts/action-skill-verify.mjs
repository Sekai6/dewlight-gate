import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";
const root = "artifacts/action-skill";
const baseline = JSON.parse(readFileSync(`${root}/baseline.json`, "utf8"));
const changed = Object.entries(baseline.files)
  .filter(
    ([path, hash]) =>
      createHash("sha256")
        .update(readFileSync(`${root}/baseline/${path}`))
        .digest("hex") !== hash,
  )
  .map(([path]) => path);
if (changed.length) throw new Error(`Baseline changed: ${changed.join(", ")}`);
const before = JSON.parse(readFileSync(`${root}/before/capture.json`, "utf8")),
  after = JSON.parse(readFileSync(`${root}/after/capture.json`, "utf8"));
expect(before.records).toHaveLength(13);
expect(after.records).toHaveLength(13);
expect(before.errors).toEqual([]);
expect(after.errors).toEqual([]);
const browser = await chromium.launch();
const clips = [],
  errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:5173/${root}/review.html`);
  for (let index = 0; index < 13; index++) {
    await page.locator("#scene").selectOption(String(index));
    await page.waitForFunction(() =>
      [...document.querySelectorAll("video")].every(
        (v) => v.readyState >= 1 && Number.isFinite(v.duration),
      ),
    );
    const videos = await page.evaluate(() =>
      [...document.querySelectorAll("video")].map((v) => ({
        src: v.getAttribute("src"),
        duration: v.duration,
        width: v.videoWidth,
        height: v.videoHeight,
      })),
    );
    for (const video of videos) {
      expect(
        Math.abs(video.duration - after.records[index].seconds),
      ).toBeLessThan(0.05);
      expect(video.width).toBe(1280);
      expect(video.height).toBe(800);
    }
    clips.push({ index, videos });
  }
  await page.locator("#scene").selectOption("0");
  await page.locator("#rate").selectOption("0.25");
  await page.locator("#play").click();
  await page.waitForTimeout(400);
  await page.locator("#pause").click();
  const sync = await page.evaluate(() => {
    const a = document.querySelector("#after"),
      b = document.querySelector("#before");
    return {
      error: Math.abs(a.currentTime - b.currentTime),
      rate: a.playbackRate,
      paused: a.paused && b.paused,
    };
  });
  expect(sync.error).toBeLessThan(0.05);
  expect(sync.rate).toBe(0.25);
  expect(sync.paused).toBe(true);
  await page.screenshot({ path: `${root}/review.png`, fullPage: true });
  expect(errors).toEqual([]);
  const result = {
    baselineFiles: Object.keys(baseline.files).length,
    baselineHashErrors: changed,
    head: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    clips,
    sync,
    errors,
  };
  expect(result.head).toBe(baseline.commit);
  writeFileSync(`${root}/verification.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      baselineFiles: result.baselineFiles,
      videos: clips.length * 2,
      sync,
      errors,
    }),
  );
} finally {
  await browser.close();
}
