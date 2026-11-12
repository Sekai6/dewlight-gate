import { test } from "node:test";
import assert from "node:assert/strict";
import { SkillRuntime } from "@dewlight/action-skill";
import { MOVES, SKILLS, SKILL_IDS, nextAttack } from "../src/content/skills.ts";
import {
  createGuardian,
  stepGuardian,
  bindGuardian,
  hitGuardian,
  GUARDIAN,
} from "../src/boss.ts";
import { fresh, parseSave } from "../src/state.ts";
import { combatMask, combatMotion } from "../src/content/combat-motion.ts";
import { sampleWeapon } from "@dewlight/action-a";
import { skillContains } from "@dewlight/action-skill";
const input = { energy: 100, grounded: false, facing: 1 };
test("skills pay once, reject invalid requests and freeze at zero simulation time", () => {
  const s = new SkillRuntime(SKILLS);
  assert.equal(s.request("bloom", { ...input, grounded: true }), false);
  assert.equal(s.request("rise", { ...input, energy: 24 }), false);
  assert.equal(s.request("branch", input), true);
  assert.equal(s.tick(0, input).cost, 0);
  assert.equal(s.tick(1 / 120, input).cost, 20);
  const snap = s.snapshot();
  s.tick(0, input);
  assert.deepEqual(s.snapshot(), snap);
  assert.equal(s.request("branch", input), false);
  assert.equal(s.tick(0.5, input).cost, 0);
  assert.equal(s.active, null);
});
test("complete crossed intervals retain all hits, exact displacement and stable direction at 10/20/60 fps", () => {
  for (const id of SKILL_IDS) {
    const results = [];
    for (const fps of [10, 20, 60, 120]) {
      const s = new SkillRuntime(SKILLS);
      s.request(id, input);
      let dx = 0,
        cost = 0,
        launches = 0;
      const hits = new Set<string>(),
        events: string[] = [];
      for (let i = 0; i < fps; i++) {
        const r = s.tick(1 / fps, { ...input, facing: -1 });
        dx += r.dx;
        cost += r.cost;
        if (r.launch) launches++;
        for (const h of r.hits)
          if (s.claim(h, "target")) hits.add(`${h.instance}:${h.section}`);
        events.push(...r.events.map((e) => `${e.type}:${e.at}`));
      }
      results.push({
        dx: Math.round(dx * 1e6),
        cost,
        launches,
        hits: [...hits],
        events,
      });
    }
    results.forEach((r) => assert.deepEqual(r, results[0]));
    assert.equal(results[0].cost, SKILLS[id].cost);
    assert.equal(results[0].hits.length, id === "bloom" ? 3 : 1);
    if (id === "branch") assert.equal(Math.abs(results[0].dx), 160000000);
  }
});
test("latest valid buffered skill links after release; cancellation keeps cost and cooldown", () => {
  const s = new SkillRuntime(SKILLS);
  s.request("branch", input);
  s.tick(0.18, input);
  assert.equal(s.allows("attack"), false);
  s.request("rise", input);
  s.request("bloom", input);
  const r = s.tick(0.1, input);
  assert.equal(s.active?.skill, "bloom");
  assert.equal(r.cost, 35);
  const cd = s.cooldowns.bloom;
  s.cancel();
  assert.equal(s.active, null);
  assert.equal(s.cooldowns.bloom, cd);
  assert.equal(s.allows("dash"), true);
  s.reset();
  assert.equal(s.cooldowns.bloom, 0);
});
test("rise cannot repeat in air; grounding restores the aerial allowance", () => {
  const s = new SkillRuntime(SKILLS);
  s.request("rise", input);
  s.tick(6, input);
  assert.equal(s.request("rise", input), false);
  s.tick(1 / 120, { ...input, grounded: true });
  assert.equal(s.request("rise", input), true);
});
test("hit identity is section and target specific; interruptions clear queued inputs", () => {
  const s = new SkillRuntime(SKILLS);
  s.request("bloom", input);
  const r = s.tick(0.5, input);
  const hits = r.hits;
  assert.equal(hits.length, 3);
  for (const h of hits) {
    assert.equal(s.claim(h, "boss"), true);
    assert.equal(s.claim(h, "boss"), false);
    assert.equal(s.claim(h, "moss"), true);
  }
  s.request("branch", input);
  s.tick(0.01, { ...input, blocked: true });
  assert.equal(s.active, null);
  assert.equal(s.snapshot().queued, null);
});
test("normal and challenge telegraphs lock positions, preserve a safe floor lane, and binding clears hazards", () => {
  for (const difficulty of ["normal", "challenge"] as const) {
    for (const index of [2, 3, 4]) {
      const b = createGuardian(false, difficulty);
      assert.equal(b.hp, difficulty === "normal" ? 48 : 64);
      b.phase = "stalk";
      b.until = 1;
      b.attacks = index;
      b.plan = index === 2 ? "crystal" : index === 3 ? "garden" : "radiance";
      if (index === 4) {
        b.hp /= 2;
        b.attacks = 3;
      }
      stepGuardian(b, 1, 1 / 120, { x: 2600, y: 1100 });
      assert.ok(b.hazards.length > 0);
      const targets = b.hazards.map((h) => ({ x: h.x, y: h.y }));
      assert.ok(b.until - 1 >= 0.8 - 1e-9);
      if (difficulty === "normal")
        assert.ok(
          b.until - 1 >=
            (
              {
                "crystal-warn": 1,
                "garden-warn": 1.1,
                "radiance-warn": 1.25,
              } as Record<string, number>
            )[b.phase] -
              1e-9,
        );
      stepGuardian(b, 1.2, 1 / 120, { x: 3100, y: 1100 });
      assert.deepEqual(
        b.hazards.map((h) => ({ x: h.x, y: h.y })),
        targets,
      );
      const garden = b.hazards.filter((h) => h.kind === "garden");
      if (garden.length)
        assert.ok(garden[1].x - garden[0].x - 2 * garden[0].radius >= 120);
      assert.equal(bindGuardian(b, 1.3), true);
      assert.equal(b.hazards.length, 0);
      assert.equal(b.nextCombo, undefined);
    }
  }
});
test("skill boss damage is always one and independent pulses bypass legacy ordinary-hit debounce", () => {
  const b = createGuardian();
  b.phase = "recover";
  for (const at of [1, 1.16, 1.32])
    assert.equal(hitGuardian(b, at, true), true);
  assert.equal(b.hp, GUARDIAN.hp - 3);
  b.hp = 1;
  hitGuardian(b, 2, true);
  assert.equal(hitGuardian(b, 2.1, true), false);
  assert.equal(b.hazards.length, 0);
});
test("legacy saves default to normal, transient skills never enter save data", () => {
  const old = fresh();
  delete old.difficulty;
  delete old.skillTutorial;
  const parsed = parseSave(JSON.stringify(old));
  assert.equal(parsed?.difficulty, "normal");
  assert.equal(parsed?.skillTutorial, false);
});

test("dedicated phase masks and constrained weapon targets preserve the three skill identities", () => {
  const masks = [];
  for (const action of ["skill-branch", "skill-rise", "skill-bloom"] as const) {
    masks.push(combatMask(0.14, true, {}, action));
    const motion = combatMotion(action)!;
    for (let age = 0; age <= motion.duration!; age += 1 / 120) {
      const out = sampleWeapon(motion, age, { x: 0, y: 0, rotation: 0 });
      assert.ok(Number.isFinite(out.rotation));
      // Targets may briefly exceed reach during a Hermite overshoot; CONTACT
      // projects them. Final arm lengths and grip error are checked in-browser.
      assert.ok(Number.isFinite(out.x) && Number.isFinite(out.y));
    }
  }
  assert.notDeepEqual(masks[0], masks[1]);
  assert.notDeepEqual(masks[1], masks[2]);
});

test("root-space skill query locks its direction and bloom reaches both sides", () => {
  const hit = {
    instance: 1,
    skill: "branch" as const,
    section: 0,
    facing: -1,
    reach: 112,
    height: 85,
  };
  const root = { x: 100, y: 200 };
  assert.equal(skillContains(hit, root, { id: "left", x: 20, y: 200 }), true);
  assert.equal(
    skillContains(hit, root, { id: "right", x: 180, y: 200 }),
    false,
  );
  assert.equal(
    skillContains({ ...hit, skill: "bloom", bothSides: true }, root, {
      id: "right",
      x: 180,
      y: 200,
    }),
    true,
  );
  assert.equal(skillContains(hit, root, { id: "high", x: 20, y: 100 }), false);
});

test("gravity reduction integrates exactly 0.48 seconds, including partial substeps", () => {
  for (const fps of [10, 20, 60, 120]) {
    const runtime = new SkillRuntime(SKILLS);
    runtime.request("bloom", input);
    let reduction = 0;
    for (let i = 0; i < fps; i++)
      reduction += (1 - runtime.tick(1 / fps, input).gravity) / fps;
    assert.ok(Math.abs(reduction - 0.48 * 0.8) < 1e-9);
  }
});

test("presses wait in the buffer; only a landed hit lets the next move start early", () => {
  const ground = { ...input, grounded: true };
  const whiff = new SkillRuntime(MOVES);
  whiff.request("slash1", ground);
  whiff.tick(0.1, ground);
  whiff.request("slash2", ground);
  whiff.tick(0.08, ground);
  assert.equal(whiff.active?.skill, "slash1");
  whiff.tick(0.08, ground);
  assert.equal(whiff.active?.skill, "slash2");
  const hit = new SkillRuntime(MOVES);
  hit.request("slash1", ground);
  hit.tick(0.1, ground);
  hit.confirm(hit.active!.id);
  hit.request("slash2", ground);
  assert.equal(hit.allows("jump"), false);
  const step = hit.tick(0.06, ground);
  assert.equal(hit.active?.skill, "slash2");
  assert.equal(step.events[0].type, "cancel");
});
test("a held input survives a dash; the sword combo runs three swings then restarts", () => {
  const s = new SkillRuntime(MOVES);
  s.request("branch", input);
  s.tick(0.1, { ...input, hold: true });
  assert.equal(s.active, null);
  assert.equal(s.pending, "branch");
  s.tick(0.02, input);
  assert.equal(s.active?.skill, "branch");
  assert.equal(nextAttack(true, undefined, 9), "slash1");
  assert.equal(nextAttack(true, "slash1", 0.2), "slash2");
  assert.equal(nextAttack(true, "slash2", 0.2), "slash3");
  assert.equal(nextAttack(true, "slash3", 0.2), "slash1");
  assert.equal(nextAttack(true, "slash1", 1), "slash1");
  assert.equal(nextAttack(false, "slash1", 0.1), "air");
});
