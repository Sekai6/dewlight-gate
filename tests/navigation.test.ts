import { test } from "node:test";
import assert from "node:assert/strict";
import { guideLanding } from "../src/navigation.ts";
import { platforms, prisms } from "../src/level.ts";
test("guidance starts with reachable landings rather than a remote high objective", () => {
  for (let room = 0; room < 6; room++) {
    const target = prisms.find((p) => p.room === room && p.order === 0)!;
    const ground = platforms.findIndex((p) => p.room === room && p.y === 1100);
    const next = guideLanding(
      { x: room * 6000 + 130, y: 1100, groundIndex: ground },
      { ...target, title: "", detail: "E" },
      platforms,
    );
    assert.ok(next.y >= 985 && next.y < 1100);
    assert.ok(next.x > room * 6000 + 130 && next.x < room * 6000 + 1000);
  }
});
test("guidance explains one-way descent and nearby interactions", () => {
  const nodes = [
    { x: 0, y: 300, w: 400, room: 0 },
    { x: 0, y: 650, w: 400, room: 0 },
  ];
  const target = {
    id: "test",
    x: 200,
    y: 650,
    room: 0,
    order: 1,
    title: "",
    detail: "E · 点亮",
  };
  assert.match(
    guideLanding({ x: 200, y: 300, groundIndex: 0 }, target, nodes).action,
    /S \+ 空格/,
  );
  assert.equal(
    guideLanding({ x: 200, y: 650, groundIndex: 1 }, target, nodes).action,
    target.detail,
  );
  const shallow = [
    { x: 0, y: 620, w: 400, room: 0 },
    { x: 0, y: 650, w: 400, room: 0 },
  ];
  assert.match(
    guideLanding({ x: 200, y: 620, groundIndex: 0 }, target, shallow).action,
    /S \+ 空格/,
  );
});

test("guidance uses an intermediate landing for a rise beyond normal jump height", () => {
  const nodes = [
    { x: 0, y: 1100, w: 400, room: 0 },
    { x: 0, y: 990, w: 400, room: 0 },
    { x: 0, y: 1040, w: 400, room: 0 },
  ];
  const target = {
    id: "test",
    x: 200,
    y: 990,
    room: 0,
    order: 0,
    title: "",
    detail: "E",
  };
  assert.equal(
    guideLanding({ x: 200, y: 1100, groundIndex: 0 }, target, nodes).y,
    1040,
  );
  const gap = [
    { x: 0, y: 247.5, w: 400, room: 0 },
    { x: 450, y: 270, w: 300, room: 0 },
  ];
  const step = guideLanding(
    { x: 360, y: 247.5, groundIndex: 0 },
    { ...target, x: 600, y: 270 },
    gap,
  );
  assert.doesNotMatch(step.action, /穿下/);
});
