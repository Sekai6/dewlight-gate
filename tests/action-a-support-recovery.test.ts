import test from "node:test";
import assert from "node:assert/strict";
import {
  SupportController,
  type SupportInput,
  type SupportRig,
} from "../src/action-a/support/controller.ts";
import { RecoveryController } from "../src/action-a/recovery/controller.ts";
import { DollHitController } from "../src/action-a/doll-hit/state.ts";

const rig: SupportRig = {
  kind: "hero",
  support: {
    enabled: true,
    shift: 3.5,
    response: 18,
    counterLean: 0.016,
    lift: 12,
  },
  stride: 74,
  stance: 0.6,
  footSpan: 7,
  leg: 19,
};
const input = (): SupportInput => ({
  x: 100,
  y: 100,
  clock: 1,
  vx: 0,
  facing: 1,
  grounded: true,
  action: "idle",
  enabled: true,
  gait: 0,
  turnAt: -999,
  feet: [
    { x: -7, y: 0 },
    { x: 7, y: 0 },
  ],
  root: { x: 0, y: 0, rotation: 0 },
  combatWeight: 0,
  combatAge: 0,
  support: { id: "leaf", x: 50, y: 100, left: 50, right: 150 },
});

test("SUPPORT substeps match 120 Hz anchors under linear platform motion", () => {
  const run = (fps: number) => {
    const c = new SupportController();
    let previous = input();
    c.update(previous, null, rig);
    for (let n = 1; n <= fps; n++) {
      const t = n / fps;
      const next = {
        ...input(),
        clock: 1 + t,
        x: 100 + 20 * t,
        y: 100 + 10 * t,
        support: {
          id: "leaf",
          x: 50 + 20 * t,
          y: 100 + 10 * t,
          left: 50 + 20 * t,
          right: 150 + 20 * t,
        },
        feet: c.output.targets.map((p) => ({ x: p.x, y: p.y })),
      };
      c.update(next, previous, rig);
      previous = next;
    }
    return c.contacts.map((c) => ({ x: c.x, y: c.y, weight: c.weight }));
  };
  const reference = run(120);
  for (const fps of [10, 20, 60])
    run(fps).forEach((c, i) => {
      assert.ok(Math.hypot(c.x - reference[i].x, c.y - reference[i].y) < 1e-6);
      assert.ok(Math.abs(c.weight - reference[i].weight) < 1e-6);
    });
});
test("SUPPORT keeps local anchors on moving platforms, releases edges and does not repeat events while paused", () => {
  const c = new SupportController(),
    a = input();
  c.update(a, null, rig);
  const anchors = c.contacts.map((f) => f.localX);
  const b = {
    ...a,
    clock: 1 + 1 / 120,
    x: 110,
    y: 105,
    support: { id: "leaf", x: 60, y: 105, left: 60, right: 160 },
  };
  c.update(b, a, rig);
  assert.deepEqual(
    c.contacts.map((f) => f.localX),
    anchors,
  );
  c.contacts.forEach((f) => {
    assert.equal(f.x, 60 + f.localX);
    assert.equal(f.y, 105);
  });
  const saved = JSON.stringify(c);
  c.update(b, b, rig);
  assert.equal(JSON.stringify(c), saved);
  const edge = {
    ...b,
    clock: 2,
    support: { ...b.support, left: 109, right: 111 },
  };
  c.update(edge, b, rig);
  assert.ok(c.contacts.every((f) => !f.planted));
  c.reset();
  assert.ok(c.contacts.every((f) => f.weight === 0 && !f.planted));
});
test("SUPPORT excludes flight, airborne and dash, constrains pelvis once, and releases unreachable anchors", () => {
  for (const action of ["dash", "idle"]) {
    const c = new SupportController(),
      a = { ...input(), action, grounded: action === "dash" };
    c.update(a, null, rig);
    assert.ok(c.contacts.every((f) => !f.planted));
  }
  const c = new SupportController(),
    a = input();
  c.update(a, null, {
    ...rig,
    kind: "moth",
    support: { ...rig.support, enabled: false },
  });
  assert.ok(c.contacts.every((f) => !f.planted));
  c.update({ ...a, clock: 2 }, null, rig);
  const out = c.constrainBody(0, -44, rig);
  assert.ok(out.pelvisY > 0);
  assert.ok(Number.isFinite(out.chestLean));
  c.update({ ...a, clock: 2 + 1 / 120, x: 140 }, { ...a, clock: 2 }, rig);
  assert.ok(c.contacts.some((f) => !f.planted));
});
test("RECOVERY observes lock times, selects reachable free-hand contact and releases over edges", () => {
  const d = new DollHitController(),
    r = new RecoveryController();
  d.start({
    kind: "charge",
    instance: "one",
    sourceX: 0,
    sourceY: 0,
    direction: 1,
  });
  const base = {
    clock: 1,
    x: 100,
    y: 100,
    facing: 1,
    grounded: true,
    action: "hurt",
    doll: d.state,
    support: { id: "floor", x: 0, y: 100, left: 0, right: 200 },
    shoulder: { x: 108, y: 80 },
  };
  r.update(base);
  d.tick(0.3, false);
  d.requestRecovery();
  d.tick(1 / 120, true);
  const unchanged = JSON.stringify(d.state);
  const out = r.update({ ...base, clock: 1.31 });
  assert.equal(out.state.path, "brace");
  assert.ok(out.hand.weight > 0);
  assert.equal(JSON.stringify(d.state), unchanged);
  r.update({ ...base, clock: 1.32, support: { ...base.support, right: 105 } });
  assert.equal(out.hand.weight, 0);
  assert.equal(out.state.path, "stand");
  r.update({ ...base, clock: 1.33, grounded: false });
  assert.equal(out.state.path, "air");
  assert.equal(out.hand.weight, 0);
  const paused = JSON.stringify(out);
  r.update({ ...base, clock: 1.33 });
  assert.equal(JSON.stringify(out), paused);
  d.tick(0.2, false);
  r.update({
    ...base,
    clock: 1.53,
    doll: undefined,
    action: "fall",
    grounded: false,
  });
  r.update({
    ...base,
    clock: 1.66,
    doll: undefined,
    action: "fall",
    grounded: false,
  });
  assert.equal(out.state.active, false);
  r.reset();
  assert.equal(out.state.instance, "");
  assert.equal(out.hand.weight, 0);
});
test("RECOVERY interruption and new impacts cannot carry old hand anchors or extend gameplay", () => {
  const r = new RecoveryController(),
    d = new DollHitController();
  d.start({
    kind: "ground",
    instance: "light",
    direction: -1,
    sourceX: 0,
    sourceY: 0,
  });
  d.tick(0.2, false);
  d.land(120);
  const base = {
    clock: 2,
    x: 100,
    y: 100,
    facing: 1,
    grounded: true,
    action: "hurt",
    doll: d.state,
  };
  r.update(base);
  assert.equal(r.state.path, "slide");
  d.tick(0.4, true);
  r.update({ ...base, clock: 2.4, doll: undefined, action: "slash" });
  assert.equal(r.state.active, false);
  assert.equal(r.output.hand.weight, 0);
  d.reset();
  d.start({
    kind: "wave",
    instance: "next",
    direction: 1,
    sourceX: 0,
    sourceY: 0,
  });
  r.update({ ...base, clock: 2.5 });
  assert.equal(r.state.instance, "next");
  assert.equal(r.state.path, "none");
});
