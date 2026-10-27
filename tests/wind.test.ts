import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleWind, windZones } from "../src/wind.ts";

test("wind has readable boundaries, repeatable gusts and a safe opening", () => {
  assert.equal(windZones.length, 12);
  assert.equal(sampleWind(130, 1100, 0).lift, 0);
  assert.equal(sampleWind(1750, 700, 0).lift, 0);
  assert.equal(sampleWind(1640, 900, 0).lift, 0);
  assert.ok(sampleWind(1750, 900, 0).lift > 1350);
  assert.ok(sampleWind(3800, 900, 0).x > 0);
  assert.ok(sampleWind(9800, 900, 0).x < 0);
  assert.deepEqual(sampleWind(1750, 900, 12), sampleWind(1750, 900, 12));
  assert.ok(sampleWind(3800, 900, 2, { "wind-glide-0": 8 }).x < 0);
  assert.ok(sampleWind(3800, 900, 8, { "wind-glide-0": 8 }).x > 0);
});
