import { test } from "node:test";
import assert from "node:assert/strict";
import { ContactController } from "../src/action-a/contact/controller.ts";
import { ImpulseController } from "../src/action-a/impulse/controller.ts";
import {
  IntentController,
  IntentSelector,
} from "../src/action-a/intent/controller.ts";

test("impulse delays, instance deduplication, interruption, pause and reset", () => {
  const c = new ImpulseController();
  const input = {
    clock: 0,
    action: "slash",
    age: 0,
    instance: "a",
    vx: 0,
    facing: 1,
    grounded: true,
  };
  c.update(input, "hero");
  c.update({ ...input, clock: 1 / 120, age: 1 / 120 }, "hero");
  assert.ok(c.output.hip > 0);
  assert.equal(c.output.head, 0);
  for (let i = 2; i < 30; i++)
    c.update({ ...input, clock: i / 120, age: i / 120 }, "hero");
  assert.equal(c.events, 1);
  const before = structuredClone(c.output);
  c.update({ ...input, clock: 29 / 120, age: 0, instance: "b" }, "hero");
  assert.deepEqual(c.output, before);
  c.update({ ...input, clock: 30 / 120, age: 0, instance: "b" }, "hero");
  assert.equal(c.events, 2);
  for (let i = 31; i < 500; i++)
    c.update(
      { ...input, action: "idle", clock: i / 120, age: i / 120 },
      "hero",
    );
  assert.ok(Math.abs(c.output.hip) < 0.001);
  c.reset();
  assert.equal(c.output.hip, 0);
  assert.equal(c.events, 0);
});

test("contact releases unreachable and out-of-bounds anchors without stretching", () => {
  const c = new ContactController();
  const r = {
    id: "foot",
    kind: "foot" as const,
    anchorX: 0,
    anchorY: 0,
    x: 10,
    y: 15,
    upper: 12,
    lower: 12,
    bend: 1,
    weight: 1,
    valid: true,
    surfaceId: "leaf",
    surfaceX: 5,
    surfaceY: 15,
    left: 0,
    right: 20,
  };
  let out = c.solve(r, 1 / 120);
  assert.equal(out.state.localX, 5);
  assert.ok(out.error < 1e-6);
  out = c.solve({ ...r, x: 15, surfaceX: 10 }, 1 / 120);
  assert.equal(out.state.localX, 5);
  out = c.solve({ ...r, x: 21, freeX: 10, freeY: 15 }, 1 / 120);
  assert.equal(out.state.reason, "edge");
  assert.ok(out.error < 1e-6);
  out = c.solve({ ...r, x: 30, right: 40, freeX: 10, freeY: 15 }, 1 / 120);
  assert.equal(out.state.reason, "unreachable");
  assert.ok(out.error < 1e-6);
  c.reset();
  assert.equal(c.snapshot().length, 0);
});

test("contact priority gives the weapon ownership before a brace", () => {
  const c = new ContactController();
  const request = {
    id: "hand",
    anchorX: 0,
    anchorY: 0,
    x: 10,
    y: 10,
    upper: 12,
    lower: 11,
    bend: -1,
    weight: 1,
    valid: true,
  };
  const results = c.solveBatch(
    [
      { ...request, kind: "brace" },
      { ...request, kind: "grip" },
    ],
    1 / 120,
  );
  assert.equal(results[0].state.reason, "");
  assert.equal(results[1].state.reason, "priority");
  c.beginFrame();
  c.endFrame(0);
  assert.equal(c.snapshot()[0].state.weight, 1);
  c.endFrame(0.04);
  assert.equal(c.snapshot()[0].state.phase, "release");
  assert.equal(c.snapshot()[0].state.weight, 0.5);
  c.endFrame(0.04);
  assert.equal(c.snapshot()[0].state.weight, 0);
});

test("attention holds, switches for threats, excludes behind/range and locks warnings", () => {
  const s = new IntentSelector();
  const a = { id: "a", x: 100, y: 0, threat: false },
    b = { id: "b", x: 60, y: 0, threat: false };
  assert.equal(s.choose(0, 0, 0, 1, [a])?.id, "a");
  assert.equal(s.choose(0.2, 0, 0, 1, [a, b])?.id, "a");
  assert.equal(s.choose(0.36, 0, 0, 1, [a, b])?.id, "b");
  assert.equal(s.choose(0.37, 0, 0, 1, [{ ...a, threat: true }, b])?.id, "a");
  assert.equal(s.choose(1, 0, 0, 1, [{ ...a, threat: true }, b])?.id, "a");
  assert.equal(
    s.choose(2, 0, 0, 1, [
      { ...a, x: -10 },
      { ...b, y: 121 },
    ]),
    undefined,
  );
  const c = new IntentController();
  const input = {
    clock: 0,
    x: 0,
    y: 0,
    facing: 1,
    vx: 0,
    action: "idle",
    age: 0,
    target: { ...a, y: -100 },
  };
  for (let i = 0; i < 120; i++) c.update({ ...input, clock: i / 120 }, "hero");
  assert.ok(Math.abs(c.state.head) <= (18 * Math.PI) / 180);
  assert.ok(Math.abs(c.state.chest) <= (6 * Math.PI) / 180);
  const paused = { ...c.state };
  c.update({ ...input, clock: 119 / 120, target: b }, "hero");
  assert.deepEqual(c.state, paused);
  for (let i = 120; i < 240; i++)
    c.update(
      {
        ...input,
        clock: i / 120,
        lockedDirection: 1,
        target: { ...a, x: -100 },
      },
      "hero",
    );
  assert.ok(Math.abs(c.state.head + 0.04) < 0.001);
  c.reset();
  assert.equal(c.state.head, 0);
  assert.equal(c.state.targetId, null);
});
