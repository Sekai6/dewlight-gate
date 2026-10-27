import { test } from "node:test";
import assert from "node:assert/strict";
import { windSceneryPose } from "../src/wind-landscape.ts";

test("wind scenery follows direction, moves with world time and respects reduced motion", () => {
  const east = windSceneryPose(3, 95, 1, false);
  const west = windSceneryPose(3, -95, 1, false);
  assert.equal(east.bend, -west.bend);
  assert.equal(east.tip, -west.tip);
  assert.notDeepEqual(east, windSceneryPose(4, 95, 1, false));
  assert.deepEqual(east, windSceneryPose(3, 95, 1, false));
  assert.deepEqual(
    windSceneryPose(3, 95, 1, true),
    windSceneryPose(400, 95, 1, true),
  );
});
