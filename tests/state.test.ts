import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, parseSave, collect, formatTime } from "../src/state.ts";
test("存档校验与损坏恢复", () => {
  assert.equal(parseSave("{"), null);
  assert.equal(parseSave('{"version":1}'), null);
  assert.deepEqual(parseSave(JSON.stringify(fresh())), fresh());
  const s = fresh();
  s.checkpoint = 8;
  assert.equal(parseSave(JSON.stringify(s)), null);
});
test("重复收集不增加资源，恢复存档保持去重", () => {
  const s = fresh();
  assert.equal(collect(s, "bead-1"), true);
  assert.equal(collect(s, "bead-1"), false);
  s.beads.push("bead-1");
  assert.equal(parseSave(JSON.stringify(s))?.beads.length, 1);
  assert.equal(formatTime(125000), "02:05");
});
test("旧存档补齐棱镜进度，非法棱镜数据拒绝加载", () => {
  const old: any = fresh();
  delete old.lenses;
  assert.deepEqual(parseSave(JSON.stringify(old))?.lenses, []);
  old.lenses = [42];
  assert.equal(parseSave(JSON.stringify(old)), null);
  old.lenses = ["lens-0-0", "lens-0-0"];
  assert.deepEqual(parseSave(JSON.stringify(old))?.lenses, ["lens-0-0"]);
});
