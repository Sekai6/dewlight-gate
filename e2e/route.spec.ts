import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
test("compact first chapter, guardian and remaining regions complete through real guide controls", () => {
  test.setTimeout(90000);
  execFileSync(process.execPath, ["scripts/guidance-route.mjs"], {
    env: { ...process.env, GUIDE_FULL: "1" },
    timeout: 80000,
  });
  const result = JSON.parse(
    readFileSync("artifacts/guidance/route-report.json", "utf8"),
  );
  expect(result.complete).toBe(true);
  expect(result.guardianDefeated).toBe(true);
  expect(result.stones).toEqual([0, 1, 2]);
  expect(result.lenses).toHaveLength(20);
  expect(result.firstClearSeconds).toBeGreaterThan(12);
  expect(result.firstClearSeconds).toBeLessThan(120);
});
