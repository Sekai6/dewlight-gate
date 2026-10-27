import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreferences, defaultPreferences } from "../src/preferences.ts";
import { attractPickup } from "../src/pickups.ts";
import { fresh, parseSave } from "../src/state.ts";
test("preferences tolerate damaged storage and normalize volume", () => {
  assert.deepEqual(parsePreferences("{"), defaultPreferences());
  assert.equal(parsePreferences('{"volume":8,"muted":true}').volume, 1);
  assert.equal(parsePreferences('{"guide":false,"shake":false}').guide, false);
  assert.equal(
    parsePreferences('{"volume":"0","reduced":"false"}').volume,
    0.35,
  );
});
test("pickup attraction is local, frame independent and cannot pull across distant floors", () => {
  const player = { x: 0, y: 100 };
  const far = { x: 89, y: 72 },
    upper = { x: 0, y: 10 };
  assert.equal(attractPickup(far, player, 1 / 60), false);
  assert.equal(far.x, 89);
  assert.equal(attractPickup(upper, player, 1 / 60), false);
  assert.equal(upper.y, 10);
  const a = { x: 75, y: 72 },
    b = { ...a };
  for (let i = 0; i < 12; i++) attractPickup(a, player, 1 / 120);
  for (let i = 0; i < 6; i++) attractPickup(b, player, 1 / 60);
  assert.ok(Math.abs(a.x - b.x) < 1e-9);
  assert.ok(a.x > 0 && a.x < 36);
});
test("old saves gain safe-position support without discarding progress", () => {
  const old: any = fresh();
  delete old.position;
  old.beads = ["bead-1"];
  assert.equal(parseSave(JSON.stringify(old))?.position, null);
  old.position = { x: 700, y: 1020 };
  assert.deepEqual(parseSave(JSON.stringify(old))?.position, old.position);
  old.position = { x: "700", y: 1020 };
  const recovered = parseSave(JSON.stringify(old));
  assert.equal(recovered?.position, null);
  assert.deepEqual(recovered?.beads, ["bead-1"]);
});
