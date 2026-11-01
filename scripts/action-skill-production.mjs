import { chromium, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch();
const results = [];
try {
  for (const query of ["action-a", "action-skill"]) {
    const page = await browser.newPage();
    const errors = [],
      bad = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) bad.push(r.url());
    });
    await page.goto(`http://127.0.0.1:4173/?${query}`);
    await page.locator('[data-action="new"]').click();
    await expect(page.locator(".skill-slot")).toHaveCount(3);
    await page.keyboard.press("q");
    await page.waitForTimeout(170);
    await page.keyboard.press("r");
    await page.waitForTimeout(350);
    await page.keyboard.press("f");
    await page.waitForTimeout(180);
    await expect(page.locator(".hud")).toContainText("20");
    await page.keyboard.press("Escape");
    const result = await page.evaluate(() => ({
      debugAbsent: !("dewlight" in window),
      previewAbsent:
        !document.querySelector("#studio") && !document.querySelector("#stage"),
      saved: !!localStorage.getItem("dewlight.save.v2"),
    }));
    expect(result).toEqual({
      debugAbsent: true,
      previewAbsent: true,
      saved: true,
    });
    await page.reload();
    await page.locator('[data-action="continue"]').click();
    await expect(page.locator(".skill-slot[data-skill=branch]")).toContainText(
      "就绪",
    );
    expect(errors).toEqual([]);
    expect(bad).toEqual([]);
    results.push({ query, ...result, errors, bad });
    await page.close();
  }
  writeFileSync(
    "artifacts/action-skill/production.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
