import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const output = process.env.ACTION_A_OUTPUT || "artifacts/action-a";
const browser = await chromium.launch();
try {
  const p = await browser.newPage();
  const errors = [],
    bad = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 400) bad.push(r.url());
  });
  await p.goto(`${process.env.PLAY_URL || "http://127.0.0.1:4173"}/?action-a`);
  await p.getByRole("button", { name: "开启旅程" }).click();
  await p.keyboard.down("d");
  await p.waitForTimeout(350);
  await p.keyboard.up("d");
  await p.keyboard.press("Space");
  await p.keyboard.press("j");
  await p.waitForTimeout(150);
  await p.keyboard.press("Tab");
  await expect(p.getByRole("button", { name: "继续探索" })).toBeVisible();
  const result = await p.evaluate(() => ({
    debugAbsent: !("dewlight" in window),
    previewAbsent: !document.querySelector("#studio"),
    saved: !!localStorage.getItem("dewlight.save.v2"),
  }));
  expect(result).toEqual({
    debugAbsent: true,
    previewAbsent: true,
    saved: true,
  });
  expect(errors).toEqual([]);
  expect(bad).toEqual([]);
  mkdirSync(output, { recursive: true });
  writeFileSync(
    `${output}/production.json`,
    JSON.stringify({ ...result, errors, bad }, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
