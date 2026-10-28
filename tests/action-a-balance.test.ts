import { test } from "node:test";
import assert from "node:assert/strict";
import {
  approach,
  balanceTarget,
  footPhase,
  supportWeight,
  solveArm,
} from "../src/action-a/balance.ts";
import {
  combatMask,
  COMBAT_MOTIONS,
  sampleWeapon,
} from "../src/action-a/combat-motion.ts";

test("support load transfers continuously and flying profiles cannot move the pelvis", () => {
  assert.equal(footPhase(0.05, 0.6), "load");
  assert.equal(footPhase(0.3, 0.6), "stance");
  assert.equal(footPhase(0.55, 0.6), "toe-off");
  assert.equal(footPhase(0.8, 0.6), "swing");
  assert.equal(supportWeight(0.6, 0.6), 0);
  const profile = {
    enabled: true,
    shift: 4,
    response: 18,
    counterLean: 0.01,
    lift: 10,
  };
  assert.ok(balanceTarget(-10, 10, 1, 0, 0, 1, profile) < 0);
  assert.ok(balanceTarget(-10, 10, 0, 1, 0, 1, profile) > 0);
  assert.equal(
    balanceTarget(-10, 10, 1, 0, 1000, 1, { ...profile, enabled: false }),
    0,
  );
  assert.equal(approach(3, 10, 0, 18), 3);
  assert.ok(
    Math.abs(
      approach(approach(0, 5, 0.05, 18), 5, 0.05, 18) - approach(0, 5, 0.1, 18),
    ) < 1e-10,
  );
});

test("arm solver keeps rigid lengths and a continuous elbow side across the angle boundary", () => {
  const out = { elbowX: 0, elbowY: 0, x: 0, y: 0, direction: 0 };
  let previous = 0;
  for (let i = 0; i < 360; i++) {
    const angle = 2.8 + i / 180;
    solveArm(
      0,
      0,
      Math.cos(angle) * 40,
      Math.sin(angle) * 40,
      12,
      11,
      out,
      i > 0,
    );
    assert.ok(Math.abs(Math.hypot(out.elbowX, out.elbowY) - 12) < 1e-8);
    assert.ok(
      Math.abs(Math.hypot(out.x - out.elbowX, out.y - out.elbowY) - 11) < 1e-8,
    );
    if (i) assert.ok(Math.abs(out.direction - previous) < 0.01);
    assert.ok(out.x * out.elbowY - out.y * out.elbowX < 0);
    previous = out.direction;
  }
  solveArm(0, 0, 0, 0, 12, 11, out, true);
  assert.equal(out.direction, previous);
});

test("combat weights retain gait and two distinct sword paths in the air", () => {
  const mask: Parameters<typeof combatMask>[2] = {};
  combatMask(0.05, true, mask, "slash");
  const hip = mask.hip;
  const first = mask.torso;
  combatMask(0.16, true, mask, "slash");
  assert.equal(mask.hip, hip);
  assert.notEqual(mask.torso, first);
  assert.ok(typeof mask.hip === "object" && mask.hip.y! < 0.5);
  const a = { x: 0, y: 0, rotation: 0 },
    b = { ...a };
  sampleWeapon(COMBAT_MOTIONS.slash, 0.145, a, 1);
  sampleWeapon(COMBAT_MOTIONS["rising-slash"], 0.145, b, 1);
  assert.ok(Math.abs(a.rotation - b.rotation) > 2);
  assert.equal(COMBAT_MOTIONS.slash.contact, 0.085);
  assert.equal(COMBAT_MOTIONS["rising-slash"].contact, 0.085);
});
