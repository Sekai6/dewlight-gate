import { test } from "node:test";
import assert from "node:assert/strict";
import {
  platforms,
  beadId,
  prisms,
  rooms,
  stones,
  enemySpawns,
  WORLD_WIDTH,
} from "../src/level.ts";
test("later gardens keep legacy bead identities after shortening the first chapter", () => {
  const i = platforms.findIndex((p) => p.room === 1);
  assert.equal(beadId(platforms[i], i, 0), "bead-46-0");
  assert.equal(beadId(platforms[0], 0, 0), "bead-0-0");
  assert.equal(
    new Set(platforms.map((p, i) => beadId(p, i, 0))).size,
    platforms.length,
  );
});
test("六花园与三碑具备实际落脚点，开场无敌人", () => {
  assert.equal(rooms.length, 6);
  assert.equal(prisms.length, 24);
  assert.equal(stones.length, 3);
  for (const object of [...prisms, ...stones, ...enemySpawns])
    assert.ok(
      platforms.some(
        (p) =>
          object.x >= p.x &&
          object.x <= p.x + p.w &&
          Math.abs(object.y - p.y) < 1,
      ),
      `missing support at ${JSON.stringify(object)}`,
    );
  assert.ok(enemySpawns.every((e) => e.x >= 12000));
  assert.ok(platforms.every((p) => p.x >= 0 && p.x + p.w <= WORLD_WIDTH));
});
test("棱镜 ID 唯一，四种光路机关与支撑平台齐全", () => {
  assert.equal(new Set(prisms.map((p) => p.id)).size, 24);
  assert.equal(new Set(prisms.map((p) => p.mechanic)).size, 4);
  for (let room = 0; room < 6; room++) {
    const pair = prisms.filter((p) => p.room === room);
    assert.equal(pair.length, 4);
    if (room === 0) {
      assert.ok(pair.every((p, i) => i === 0 || p.x > pair[i - 1].x));
      assert.ok(pair.every((p) => p.x < 2300 && p.y >= 940));
      assert.ok(platforms.filter((p) => p.room === 0).length <= 4);
      continue;
    }
    assert.ok(pair[0].x > pair[1].x);
    assert.equal(pair[0].y, pair[1].y);
    assert.ok(pair[2].y > pair[1].y);
    assert.ok(pair[3].y > pair[2].y);
  }
  for (const p of prisms.filter((p) => p.mechanic === "hold"))
    assert.ok(platforms.some((v) => v.receiver === p.id && v.moving));
  for (const p of prisms.filter((p) => p.mechanic === "guard"))
    assert.ok(enemySpawns.some((e) => e.guard === p.id));
});

test("机关两侧保留安全站立空间", () => {
  for (const prism of prisms)
    assert.ok(
      platforms.some(
        (p) =>
          Math.abs(p.y - prism.y) < 1 &&
          prism.x - p.x >= 60 &&
          p.x + p.w - prism.x >= 60,
      ),
      `narrow ritual landing: ${prism.id}`,
    );
});
