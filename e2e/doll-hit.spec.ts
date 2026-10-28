import { test, expect } from "@playwright/test";

test("DOLL-HIT real creature strikes and root waves select their own direction and grade", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const hits = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const out = [];
    for (const type of [0, 1]) {
      const e = s.enemies.find((e: any) => e.type === type);
      s.resetAnimations();
      s.clock = 20 + type * 10;
      s.x = e.x + 25;
      s.y = e.y;
      s.vx = 0;
      s.vy = 0;
      s.hp = 5;
      s.hurtAt = -999;
      s.dashAt = -999;
      s.facing = -1;
      e.phase = "strike";
      e.phaseAt = s.clock;
      e.attackDir = 1;
      e.attackHit = false;
      e.bound = 0;
      e.hp = 2;
      s.clock += 1 / 120;
      s.step(1 / 120);
      out.push({
        kind: s.doll.state.kind,
        active: s.doll.state.active,
        vx: s.vx,
        hp: s.hp,
      });
    }
    s.resetAnimations();
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    s.clock = 50;
    s.x = 2700;
    s.y = 1100;
    s.vx = 0;
    s.vy = 0;
    s.hp = 5;
    s.hurtAt = -999;
    s.dashAt = -999;
    s.facing = 1;
    s.guardian.phase = "recover";
    s.guardian.phaseAt = 50;
    s.guardian.until = 52;
    s.guardian.wave = [{ x: 2710, dir: -1, hit: false }];
    s.clock += 1 / 120;
    s.step(1 / 120);
    out.push({
      kind: s.doll.state.kind,
      active: s.doll.state.active,
      vx: s.vx,
      hp: s.hp,
    });
    return out;
  });
  expect(hits).toEqual([
    { kind: "ground", active: true, vx: 180, hp: 4 },
    { kind: "flying", active: true, vx: 320, hp: 4 },
    { kind: "wave", active: true, vx: -280, hp: 4 },
  ]);
});

test("DOLL-HIT Boss impact, arena bounds, attack interruption, pause and death reset", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const report = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    s.clock = 20;
    s.x = 2700;
    s.y = 1100;
    s.vx = 0;
    s.vy = 0;
    s.onGround = true;
    s.guardian.phase = "charge";
    s.guardian.phaseAt = 20;
    s.guardian.x = 2730;
    s.guardian.facing = -1;
    s.guardian.chargeEnd = 2500;
    s.guardian.until = 21;
    s.facing = -1;
    s.hurtAt = -999;
    s.dashAt = -999;
    s.attackAt = 20;
    s.attackResolved = false;
    s.clock += 1 / 120;
    s.step(1 / 120);
    s.draw();
    const hit = {
      kind: s.doll.state.kind,
      active: s.doll.state.active,
      vx: s.vx,
      hp: s.hp,
      cancel: s.attackResolved,
    };
    const snapshot = JSON.stringify(s.art.actor.snapshot());
    s.draw();
    const frozen = JSON.stringify(s.art.actor.snapshot()) === snapshot;
    const arena = { ...s.arena };
    s.x = arena.left + 16;
    s.vx = -620;
    s.clock += 1 / 120;
    s.step(1 / 120);
    const wall = s.x >= arena.left + 15 && s.vx >= 0;
    for (let i = 0; i < 270; i++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    s.hurtAt = -999;
    s.doll.reset();
    s.hp = 1;
    s.damage(false, 1, {
      kind: "wave",
      direction: 1,
      sourceX: s.x - 20,
      sourceY: s.y,
      instance: "fatal",
    });
    return {
      hit,
      frozen,
      wall,
      fatal: { hp: s.hp, active: s.doll.state.active, vx: s.vx, vy: s.vy },
    };
  });
  expect(report.hit).toMatchObject({
    kind: "charge",
    active: true,
    hp: 4,
    cancel: true,
  });
  expect(report.hit.vx).toBe(-620);
  expect(report.frozen).toBe(true);
  expect(report.wall).toBe(true);
  expect(report.fatal).toEqual({ hp: 5, active: false, vx: 0, vy: 0 });
});

test("DOLL-HIT preview offers reproducible hits and buffered recovery", async ({
  page,
}) => {
  await page.goto("/?action-a");
  await expect(page.locator("#doll-kind")).toBeVisible();
  await page.locator("#doll-kind").selectOption("wave");
  await page.locator("#doll-air").check();
  await page.locator("#doll-auto").check();
  await expect(page.locator("#diagnostics")).toContainText("DOLL-HIT");
  await page.locator("#pause").click();
  await expect(page.locator("#diagnostics")).toContainText("已暂停");
  const before = await page.locator("#diagnostics").textContent();
  await page.waitForTimeout(100);
  expect(await page.locator("#diagnostics").textContent()).toBe(before);
});

test("DOLL-HIT actual damage, constrained pose, recovery and fixed simulation", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const result = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const runs: any[] = [];
    for (const fps of [10, 20, 60])
      for (const kind of ["ground", "flying", "charge", "wave"]) {
        s.resetAnimations();
        s.clearInput();
        s.x = 400;
        s.y = 1100;
        s.vx = 0;
        s.vy = 0;
        s.onGround = true;
        s.groundIndex = 0;
        s.clock = 20;
        s.hurtAt = -999;
        s.dashAt = -999;
        s.hp = 5;
        s.facing = -1;
        s.draw();
        s.damage(false, 1, {
          kind,
          sourceX: 350,
          sourceY: 1100,
          direction: 1,
          instance: `${fps}:${kind}`,
        });
        const impulse = [s.vx, s.vy];
        s.damage(false, -1);
        let grip = 0,
          length = 0,
          visible = false;
        const trajectory: number[][] = [];
        for (let frame = 0; frame < fps * 2.5; frame++) {
          for (let sub = 0; sub < 120 / fps; sub++) {
            s.clock += 1 / 120;
            s.step(1 / 120);
          }
          s.draw();
          const p = s.art.actor.snapshot();
          if (p.doll?.active) {
            visible = true;
            grip = Math.max(
              grip,
              Math.hypot(p.hand.x - p.weaponBase.x, p.hand.y - p.weaponBase.y),
            );
            length = Math.max(
              length,
              Math.abs(
                Math.hypot(
                  p.bones.arm.x - p.bones.fore.x,
                  p.bones.arm.y - p.bones.fore.y,
                ) /
                  12 -
                  1,
              ),
              Math.abs(
                Math.hypot(
                  p.bones.fore.x - p.bones.weapon.x,
                  p.bones.fore.y - p.bones.weapon.y,
                ) /
                  11 -
                  1,
              ),
            );
          }
          if ((frame + 1) % (fps / 10) === 0) trajectory.push([s.x, s.y]);
        }
        runs.push({
          fps,
          kind,
          impulse,
          grip,
          length,
          visible,
          active: s.doll.state.active,
          hp: s.hp,
          trajectory,
        });
      }
    const recoveries = [];
    for (const key of ["SPACE", "SHIFT"]) {
      s.resetAnimations();
      s.clearInput();
      s.x = 400;
      s.y = 1000;
      s.clock = 40;
      s.hurtAt = -999;
      s.dashAt = -999;
      s.bindAt = -999;
      s.hp = 5;
      s.damage(false, 1, {
        kind: "wave",
        sourceX: 350,
        sourceY: 1100,
        direction: 1,
        instance: key,
      });
      for (let i = 0; i < 60; i++) {
        if (i === 30) s.pendingKeys.add(key);
        s.clock += 1 / 120;
        s.step(1 / 120);
      }
      recoveries.push({
        active: s.doll.state.active,
        recovered: s.doll.state.recovered,
        dash: s.dashAt,
        bind: s.bindAt,
      });
    }
    return { runs, recoveries };
  });
  for (const run of result.runs) {
    expect(run.visible).toBe(true);
    expect(run.active).toBe(false);
    expect(run.hp).toBe(4);
    expect(run.grip).toBeLessThanOrEqual(1);
    expect(run.length).toBeLessThanOrEqual(0.01);
    const reference = result.runs.find(
      (r) => r.kind === run.kind && r.fps === 10,
    )!;
    run.trajectory.forEach((p: number[], i: number) =>
      expect(
        Math.hypot(
          p[0] - reference.trajectory[i][0],
          p[1] - reference.trajectory[i][1],
        ),
      ).toBeLessThanOrEqual(3),
    );
  }
  for (const r of result.recoveries) {
    expect(r.active).toBe(false);
    expect(r.recovered).toBe(true);
    expect(r.dash).toBe(-999);
    expect(r.bind).toBe(-999);
  }
});
