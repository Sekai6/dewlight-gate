import { createRig, getClip } from "../src/action-a/rigs.ts";
import {
  combatMotion,
  sampleWeapon,
  combatMask,
} from "../src/action-a/combat-motion.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Animator,
  AnimationLayer,
  PoseBuffer,
  CompiledClip,
  inertialOffset,
  FollowSpring,
  angleDelta,
  blendPose,
  restPose,
  sampleClip,
  sampleTrack,
  solveIK,
  worldPose,
  type Bone,
  type Clip,
} from "../src/action-a/core.ts";
test("ACTION-A inertia preserves incoming position and velocity and expires smoothly", () => {
  const h = 1e-6;
  assert.equal(inertialOffset(3, -2, 0, 0.2), 3);
  assert.ok(Math.abs((inertialOffset(3, -2, h, 0.2) - 3) / h + 2) < 0.01);
  assert.equal(inertialOffset(3, -2, 0.2, 0.2), 0);
  assert.equal(inertialOffset(3, -2, 1, 0.2), 0);
  assert.ok(Math.abs(inertialOffset(3, -2, 0.2 - h, 0.2) / h) < 0.01);
});

test("ACTION-A repeated interruptions preserve pose and authored continuous sword winding", () => {
  const a = new Animator(bones);
  const full: Clip = {
    name: "turns",
    duration: 1,
    tracks: [
      {
        bone: "arm",
        channel: "rotation",
        unwrapped: true,
        keys: [
          { time: 0, value: 0 },
          { time: 1, value: Math.PI * 4 },
        ],
      },
    ],
  };
  a.update(full, 0, 0);
  assert.ok(a.update(full, 0.75, 0.75).pose.arm.rotation > Math.PI * 2);
  let clock = 1;
  for (let n = 0; n < 20; n++) {
    const old = structuredClone(a.pose);
    a.update(n % 2 ? full : clip, 0, clock, undefined, n);
    assert.deepEqual(a.pose, old);
    a.update(n % 2 ? full : clip, 0.01, clock + 0.01, undefined, n);
    clock += 0.02;
    assert.ok(Number.isFinite(a.pose.arm.rotation));
  }
});

test("ACTION-A compiled sampling reuses poses without allocating buffers", () => {
  const storage = new PoseBuffer(bones),
    compiled = new CompiledClip(bones, clip);
  const count = PoseBuffer.allocations,
    pose = storage.pose,
    arm = pose.arm;
  for (let n = 0; n < 1000; n++) {
    assert.equal(compiled.sample(n / 1000, storage), pose);
    assert.equal(storage.pose.arm, arm);
  }
  assert.equal(PoseBuffer.allocations, count);
});

test("ACTION-A independent layers preserve masked locomotion, pause and reset", () => {
  const base = new AnimationLayer("base", bones),
    upper = new AnimationLayer("combat", bones, new Set(["arm"]));
  base.evaluate(clip, 0.3, 1);
  upper.evaluate(clip, 0.7, 1);
  const target = restPose(bones);
  target.root.x = 123;
  upper.weight = 0.5;
  upper.apply(target);
  assert.equal(target.root.x, 123);
  assert.equal(base.age, 0.3);
  assert.equal(upper.age, 0.7);
  assert.equal(target.arm.rotation, upper.animator.pose.arm.rotation / 2);
  const before = structuredClone(upper.animator.pose);
  upper.evaluate(clip, 0.7, 1);
  assert.deepEqual(upper.animator.pose, before);
  upper.enabled = false;
  const disabled = structuredClone(target);
  upper.apply(target);
  assert.deepEqual(target, disabled);
  upper.reset();
  assert.equal(upper.age, 0);
  assert.equal(upper.weight, 0);
});

test("ACTION-A affine hierarchy retains nonuniform parent scaling under child rotation", () => {
  const rig: Bone[] = [
    { name: "root", rest: { scaleX: 2, scaleY: 1 } },
    { name: "arm", parent: "root", rest: { x: 3, rotation: Math.PI / 2 } },
    { name: "hand", parent: "arm", rest: { x: 4 } },
  ];
  const world = worldPose(rig, restPose(rig));
  assert.ok(Math.abs(world.hand.x - 6) < 1e-8);
  assert.ok(Math.abs(world.hand.y - 4) < 1e-8);
  assert.ok(Math.abs(world.arm.c + 2) < 1e-8);
  const arm = world.arm;
  assert.equal(worldPose(rig, restPose(rig), world).arm, arm);
});
const bones: Bone[] = [
  { name: "root", rest: { x: 5 } },
  { name: "arm", parent: "root", rest: { x: 3 } },
];
const clip: Clip = {
  name: "swing",
  duration: 1,
  tracks: [
    {
      bone: "arm",
      channel: "rotation",
      keys: [
        { time: 0, value: (170 * Math.PI) / 180 },
        { time: 1, value: (-170 * Math.PI) / 180 },
      ],
    },
  ],
  events: [{ time: 0.2, name: "strike" }],
};

test("ACTION-A Hermite endpoints and tangents remain continuous", () => {
  const t = {
    bone: "arm",
    channel: "x" as const,
    interpolation: "hermite" as const,
    keys: [
      { time: 0, value: 0, tangentOut: 2 },
      { time: 1, value: 3, tangentIn: 4, tangentOut: 4 },
      { time: 2, value: 5, tangentIn: 0 },
    ],
  };
  assert.equal(sampleTrack(t, 0), 0);
  assert.equal(sampleTrack(t, 1), 3);
  assert.equal(sampleTrack(t, 2), 5);
  const h = 1e-6;
  assert.ok(Math.abs(sampleTrack(t, h) / h - 2) < 0.001);
  assert.ok(Math.abs((sampleTrack(t, 1 + h) - 3) / h - 4) < 0.001);
  assert.ok(Math.abs((3 - sampleTrack(t, 1 - h)) / h - 4) < 0.001);
});
test("ACTION-A weighted per-channel additive layers preserve untouched gait", () => {
  const layer = new AnimationLayer("reaction", bones);
  layer.evaluate(clip, 0.5, 1);
  layer.weight = 1;
  const target = restPose(bones);
  target.root.y = 7;
  target.arm.rotation = 0.25;
  layer.apply(target, 0.5, { arm: { rotation: 0.4 } }, "additive");
  assert.equal(target.root.y, 7);
  assert.ok(Math.abs(target.arm.rotation - (0.25 + Math.PI * 0.2)) < 1e-6);
  assert.equal(target.arm.x, 3);
});
test("ACTION-A weapon curves keep the unchanged contact and distinct slash paths", () => {
  const p = { x: 0, y: 0, rotation: 0 };
  for (const action of ["slash", "rising-slash", "air-slash"] as const) {
    const motion = combatMotion(action)!;
    assert.equal(motion.contact, 0.085);
    sampleWeapon(motion, 0.085, p);
    assert.ok(p.x > 20);
    assert.ok(Number.isFinite(p.rotation));
    sampleWeapon(motion, 0.38, p);
    assert.equal(p.x, 6);
    assert.equal(p.y, 19);
  }
  const mask = combatMask(0.085, true, {});
  assert.equal(mask.arm, 1);
  assert.equal(typeof mask.hip, "object");
});
test("ACTION-A interpolates rotations across the short arc and clamps clips", () => {
  assert.ok(Math.abs(sampleTrack(clip.tracks[0], 0.5) - Math.PI) < 1e-8);
  assert.ok(
    Math.abs(
      angleDelta(
        sampleClip(bones, clip, 5).arm.rotation,
        (-170 * Math.PI) / 180,
      ),
    ) < 1e-8,
  );
  assert.ok(
    Math.abs(
      sampleClip(bones, { ...clip, loop: true }, 1.3).arm.rotation -
        sampleClip(bones, clip, 0.3).arm.rotation,
    ) < 1e-8,
  );
  const world = worldPose(bones, restPose(bones));
  assert.equal(world.arm.x, 8);
});
test("ACTION-A masked overlay preserves locomotion and interrupted transitions remain continuous", () => {
  const base = restPose(bones),
    attack = restPose(bones);
  attack.root.y = 20;
  attack.arm.rotation = 1;
  const masked = blendPose(base, attack, 1, new Set(["arm"]));
  assert.equal(masked.root.y, 0);
  assert.equal(masked.arm.rotation, 1);
  const animator = new Animator(bones, 0.1);
  animator.update(clip, 0.1, 1);
  const next: Clip = {
    name: "hurt",
    duration: 1,
    tracks: [
      { bone: "arm", channel: "rotation", keys: [{ time: 0, value: -1 }] },
    ],
  };
  const before = animator.pose.arm.rotation;
  assert.equal(animator.update(next, 0, 1.01).pose.arm.rotation, before);
  const interrupted = animator.update(next, 0.04, 1.05).pose.arm.rotation;
  assert.ok(Math.abs(angleDelta(before, interrupted)) > 0);
  assert.equal(animator.update(clip, 0.2, 1.06).pose.arm.rotation, interrupted);
});
test("ACTION-A event cursors stop when paused, handle loops and restart without duplicates", () => {
  const a = new Animator(bones, 0),
    loop = { ...clip, loop: true };
  a.update(loop, 0, 0);
  assert.deepEqual(a.update(loop, 0.25, 0.25).events, ["strike"]);
  assert.deepEqual(a.update(loop, 0.25, 0.25).events, []);
  assert.deepEqual(a.update(loop, 1.3, 1.3).events, ["strike"]);
  a.reset();
  assert.equal(a.pose.arm.rotation, 0);
  a.update(clip, 0, 2);
  assert.deepEqual(a.update(clip, 0.3, 2.3).events, ["strike"]);
  a.update(clip, 0, 3);
  assert.deepEqual(a.update(clip, 0.3, 3.3).events, ["strike"]);
});
test("ACTION-A IK keeps segment lengths for unreachable and near-zero targets", () => {
  for (const [x, y] of [
    [0, 0],
    [2, 4],
    [100, 100],
    [-12, 3],
  ])
    for (const bend of [-1, 1]) {
      const p = solveIK(0, 0, x, y, 12, 10, bend);
      assert.ok(Math.abs(Math.hypot(p.knee.x, p.knee.y) - 12) < 1e-6);
      assert.ok(
        Math.abs(Math.hypot(p.knee.x - p.foot.x, p.knee.y - p.foot.y) - 10) <
          1e-5,
      );
    }
});
test("ACTION-A damped follow is frame-rate independent and freezes at zero dt", () => {
  const a = new FollowSpring(),
    b = new FollowSpring();
  a.update(1, 1);
  for (let i = 0; i < 120; i++) b.update(1, 1 / 120);
  assert.ok(Math.abs(a.value - b.value) < 1e-10);
  const frozen = b.value;
  assert.equal(b.update(-1, 0), frozen);
  b.reset();
  assert.equal(b.value, 0);
  assert.equal(b.velocity, 0);
});

test("ACTION-A stable instance preserves cursor across clip variants and new instances restart", () => {
  const a = new Animator(bones);
  a.update(clip, 0, 0, undefined, "attack:1");
  assert.deepEqual(a.update(clip, 0.21, 0.21, undefined, "attack:1").events, [
    "strike",
  ]);
  const variant = { ...clip, name: "air", transition: 0.03 };
  assert.deepEqual(
    a.update(variant, 0.22, 0.22, undefined, "attack:1").events,
    [],
  );
  assert.equal(a.blendWeight, 1);
  a.update(clip, 0, 0.3, undefined, "attack:2");
  assert.equal(a.blendWeight, 0);
  assert.deepEqual(a.update(clip, 0.21, 0.51, undefined, "attack:2").events, [
    "strike",
  ]);
});

test("ACTION-A clip-specific interruption freezes, resets and reaches target on schedule", () => {
  const a = new Animator(bones);
  a.update(clip, 0.1, 1);
  a.update(clip, 0.15, 1.05);
  const fast = { ...clip, name: "interrupt", transition: 0.025 };
  const before = structuredClone(a.pose);
  a.update(fast, 0, 1.06);
  assert.deepEqual(a.pose, before);
  const frozen = structuredClone(a.pose);
  a.update(fast, 0.01, 1.06);
  assert.deepEqual(a.pose, frozen);
  a.update(fast, 0.03, 1.09);
  assert.equal(a.blendWeight, 1);
  assert.deepEqual(a.pose, sampleClip(bones, fast, 0.03));
  a.reset();
  assert.equal(a.blendWeight, 1);
  assert.deepEqual(a.pose, restPose(bones));
});

test("ACTION-A guardian downstroke meets unchanged root-wave onset", () => {
  const rig = createRig("guardian"),
    warn = getClip(rig, "slam-warn"),
    slam = getClip(rig, "slam");
  assert.equal(warn.duration, 1.05);
  assert.equal(slam.duration, 0.22);
  const before = sampleClip(rig.bones, warn, warn.duration),
    contact = sampleClip(rig.bones, slam, 0);
  for (const bone of ["hip", "torso", "arm", "armBack"])
    for (const channel of ["x", "y", "rotation"] as const)
      assert.ok(
        Math.abs(before[bone][channel] - contact[bone][channel]) < 0.001,
      );
  assert.deepEqual(slam.events, [{ time: 0, name: "impact" }]);
});

test("ACTION-A aerial counterbalance preserves the contact blade direction", () => {
  const rig = createRig("hero");
  const air = getClip(rig, "air-slash"),
    ground = getClip(rig, "slash");
  const a = worldPose(rig.bones, sampleClip(rig.bones, air, 0.085));
  const b = worldPose(rig.bones, sampleClip(rig.bones, ground, 0.085));
  assert.ok(Math.abs(a.root.rotation) > 0.05);
  assert.ok(Math.abs(angleDelta(a.weapon.rotation, b.weapon.rotation)) < 1e-8);
  assert.ok(Math.abs(a.armBack.rotation - b.armBack.rotation) > 0.2);
});

test("ACTION-A guardian sustains propulsion throughout the gameplay charge window", () => {
  const rig = createRig("guardian"),
    clip = getClip(rig, "strike");
  assert.equal(clip.duration, 1.15);
  for (const age of [0.1, 0.3, 0.6, 1, 1.15]) {
    const p = sampleClip(rig.bones, clip, age);
    assert.ok(p.torso.rotation > 0.4);
    assert.ok(p.armBack.rotation > 1);
  }
});
