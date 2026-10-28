import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DollHitController,
  HIT_PROFILES,
  type HitKind,
} from "../src/action-a/doll-hit/state.ts";
import { DollPoseSolver } from "../src/action-a/doll-hit/solver.ts";
import { createGuardian, stepGuardian } from "../src/boss.ts";
const hit = (kind: HitKind = "charge", direction = -1) => ({
  kind,
  direction,
  sourceX: 0,
  sourceY: 0,
  instance: kind + direction,
});
test("DOLL-HIT profiles preserve exact impulses, direction and instance deduplication", () => {
  assert.deepEqual(
    Object.values(HIT_PROFILES).map((p) => [p.horizontal, p.upward]),
    [
      [180, 120],
      [320, 240],
      [620, 400],
      [280, 590],
    ],
  );
  const d = new DollHitController();
  assert.ok(d.start(hit()));
  assert.equal(d.state.direction, -1);
  assert.equal(d.start(hit()), false);
  d.tick(3, false);
  assert.equal(d.state.active, false);
  assert.equal(d.start(hit()), false);
  d.reset();
  assert.ok(d.start(hit()));
});
test("DOLL-HIT recovery consumes only a recent press and finishes in 120ms", () => {
  const d = new DollHitController();
  d.start(hit());
  d.requestRecovery();
  d.tick(0.3, false);
  assert.equal(d.state.phase, "air");
  d.reset();
  d.start(hit());
  d.tick(0.2, false);
  d.requestRecovery();
  d.tick(0.1, false);
  assert.equal(d.state.phase, "recover");
  d.tick(0.12, false);
  assert.equal(d.state.active, false);
  assert.ok(d.state.recovered);
});
test("DOLL-HIT pauses completely, bounds bounces and restores control within 2.2 seconds", () => {
  for (const kind of Object.keys(HIT_PROFILES) as HitKind[]) {
    const d = new DollHitController();
    d.start(hit(kind));
    d.tick(0.15, false);
    const frozen = JSON.stringify(d.state);
    d.tick(0, true);
    assert.equal(JSON.stringify(d.state), frozen);
    for (let i = 0; i < 8; i++) {
      d.land(450);
      d.tick(0.08, false);
    }
    assert.ok(d.state.bounces <= HIT_PROFILES[kind].bounces);
    d.tick(2.2, false);
    assert.equal(d.state.active, false);
    assert.ok(d.state.turnTotal <= Math.PI * 4 + 1e-8);
    d.reset();
    assert.equal(d.state.weight, 0);
    assert.equal(d.state.instance, "");
  }
});
test("DOLL-HIT state is frame-rate independent at 10/20/60 fps", () => {
  const poses = [10, 20, 60].map((fps) => {
    const d = new DollHitController();
    d.start(hit());
    for (let i = 0; i < fps; i++) d.tick(1 / fps, false);
    return d.state;
  });
  for (const p of poses) {
    assert.ok(Math.abs(p.angle - poses[0].angle) < 1e-8);
    assert.ok(Math.abs(p.age - 1) < 1e-8);
  }
});
test("DOLL-HIT inertial limbs constrain lengths through extreme targets and pause", () => {
  const s = new DollPoseSolver(),
    out = { jointX: 0, jointY: 0, x: 0, y: 0 };
  s.seed(0, 100, -80, 800, -100);
  for (let i = 0; i < 240; i++) {
    s.solve(
      0,
      0,
      -30,
      Math.sin(i / 10) * 40,
      Math.cos(i / 10) * 30,
      12,
      11,
      -1,
      1 / 120,
      1,
      0,
      out,
    );
    assert.ok(Math.abs(Math.hypot(out.jointX, out.jointY + 30) - 12) < 1e-6);
    assert.ok(
      Math.abs(Math.hypot(out.x - out.jointX, out.y - out.jointY) - 11) < 1e-6,
    );
  }
  const frozen = JSON.stringify(s.output.points);
  s.solve(0, 0, -30, 1, 1, 12, 11, -1, 0, 1, 0, out);
  assert.equal(JSON.stringify(s.output.points), frozen);
});
test("guardian reports charge and wave sources even when its phase changes on the hit tick", () => {
  const b = createGuardian();
  Object.assign(b, {
    phase: "charge",
    phaseAt: 2,
    until: 9,
    x: 2800,
    chargeEnd: 2801,
    facing: 1,
  });
  const r = stepGuardian(b, 3, 1 / 120, { x: 2802, y: 1100 });
  assert.equal(r.impact?.kind, "charge");
  assert.equal(r.impact?.direction, 1);
  assert.equal(b.phase, "recover");
  b.wave = [{ x: 2700, dir: -1, hit: false }];
  const w = stepGuardian(b, 3.1, 1 / 120, { x: 2698, y: 1100 });
  assert.equal(w.impact?.kind, "wave");
  assert.equal(w.impact?.direction, -1);
});
