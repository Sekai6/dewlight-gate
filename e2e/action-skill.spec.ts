import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

test("Q/R/F keyboard linkage, pause, resource feedback and legacy save", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  await expect(page.locator(".skill-slot")).toHaveCount(3);
  await page.keyboard.press("f");
  await expect(page.locator(".toast")).toContainText("仅空中");
  await page.keyboard.press("q");
  await page.waitForTimeout(170);
  await page.keyboard.press("r");
  await page.waitForTimeout(350);
  await page.keyboard.press("f");
  await page.waitForTimeout(180);
  const state = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return {
      energy: s.energy,
      active: s.skills.active?.skill,
      y: s.y,
      hp: s.hp,
    };
  });
  expect(state.energy).toBeCloseTo(20, 0);
  expect(state.active).toBe("bloom");
  expect(state.y).toBeLessThan(1090);
  await page.keyboard.press("Escape");
  const paused = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return JSON.stringify({
      clock: s.clock,
      skill: s.skills.snapshot(),
      energy: s.energy,
      y: s.y,
    });
  });
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => {
      const s = (window as any).dewlight.scene.getScene("journey");
      return JSON.stringify({
        clock: s.clock,
        skill: s.skills.snapshot(),
        energy: s.energy,
        y: s.y,
      });
    }),
  ).toBe(paused);
  await page.reload();
  await page.locator('[data-action="continue"]').click();
  const restored = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return {
      active: s.skills.active,
      cd: s.skills.cooldowns,
      energy: s.energy,
    };
  });
  expect(restored.active).toBeNull();
  expect(restored.cd).toEqual({ branch: 0, rise: 0, bloom: 0 });
  expect(restored.energy).toBe(100);
  expect(errors).toEqual([]);
});

test("fixed simulation skills remain identical across rendering rates and retain rigid geometry", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const result = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const runs: any[] = [];
    let swordMin = Infinity,
      swordMax = 0;
    let grip = 0,
      length = 0,
      crop = 0,
      drift = 0;
    for (const fps of [10, 20, 60])
      for (const facing of [-1, 1]) {
        s.resetAnimations();
        s.clearInput();
        s.effects.reset();
        Object.assign(s, {
          clock: 20,
          x: 700,
          y: 1100,
          vx: 0,
          vy: 0,
          energy: 100,
          hp: 5,
          facing,
          onGround: true,
          groundIndex: -1,
          attackAt: -999,
          dashAt: -999,
          hurtAt: -999,
          bindAt: -999,
          skillSpentAt: -999,
        });
        const samples: any[] = [];
        for (let tick = 0; tick < 180; tick++) {
          if (tick === 0) s.pendingKeys.add("Q");
          if (tick === 23) s.pendingKeys.add("R");
          if (tick === 61) s.pendingKeys.add("F");
          s.clock += 1 / 120;
          s.step(1 / 120);
          if (tick % (120 / fps) === 0) {
            s.draw();
            const a = s.art.actor.snapshot();
            const swordLength = Math.hypot(
              a.weaponTip.x - a.weaponBase.x,
              a.weaponTip.y - a.weaponBase.y,
            );
            swordMin = Math.min(swordMin, swordLength);
            swordMax = Math.max(swordMax, swordLength);
            grip = Math.max(
              grip,
              Math.hypot(a.hand.x - a.weaponBase.x, a.hand.y - a.weaponBase.y),
            );
            length = Math.max(
              length,
              Math.abs(
                Math.hypot(
                  a.bones.arm.x - a.bones.fore.x,
                  a.bones.arm.y - a.bones.fore.y,
                ) /
                  12 -
                  1,
              ),
              Math.abs(
                Math.hypot(
                  a.bones.fore.x - a.bones.weapon.x,
                  a.bones.fore.y - a.bones.weapon.y,
                ) /
                  11 -
                  1,
              ),
            );
            for (const c of a.corners)
              crop = Math.max(
                crop,
                Math.abs(c.x) - a.extent,
                Math.abs(c.y) - a.extent,
              );
            a.contacts.forEach((c: any, i: number) => {
              if (c.planted)
                drift = Math.max(
                  drift,
                  Math.hypot(a.feet[i].x - c.x, a.feet[i].y - c.y),
                );
            });
          }
          if ((tick + 1) % 12 === 0)
            samples.push([
              s.x,
              s.y,
              s.energy,
              s.skills.active?.skill ?? "",
              s.skills.active?.age ?? 0,
            ]);
        }
        runs.push({ fps, facing, samples });
      }
    return {
      runs,
      grip,
      length,
      crop,
      drift,
      swordRelativeError: (swordMax - swordMin) / swordMin,
    };
  });
  mkdirSync("artifacts/action-skill", { recursive: true });
  writeFileSync(
    "artifacts/action-skill/geometry.json",
    JSON.stringify(result, null, 2),
  );
  for (const direction of [-1, 1]) {
    const runs = result.runs.filter((r) => r.facing === direction);
    expect(runs[1].samples).toEqual(runs[0].samples);
    expect(runs[2].samples).toEqual(runs[0].samples);
  }
  expect(result.grip).toBeLessThanOrEqual(1);
  expect(result.length).toBeLessThanOrEqual(0.01);
  expect(result.crop).toBeLessThanOrEqual(0);
  expect(result.drift).toBeLessThanOrEqual(3);
  expect(result.swordRelativeError).toBeLessThanOrEqual(0.01);
});

test("skill collision, damage interruption, aerial limit, launch recovery and death reset", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const r = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const reset = (x = 400) => {
      s.resetAnimations();
      s.clearInput();
      Object.assign(s, {
        x,
        y: 1100,
        vx: 0,
        vy: 0,
        clock: 30,
        energy: 100,
        hp: 5,
        hurtAt: -999,
        dashAt: -999,
        attackAt: -999,
        facing: 1,
        onGround: true,
      });
    };
    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        s.clock += 1 / 120;
        s.step(1 / 120);
      }
    };
    reset(s.layout.rooms[0].gate - 40);
    const gate = s.layout.rooms[0].gate;
    s.pendingKeys.add("Q");
    step(50);
    const closed = s.x <= gate - 15;
    reset();
    s.pendingKeys.add("Q");
    step(15);
    const paid = s.energy;
    s.damage(false, -1, {
      kind: "ground",
      sourceX: 500,
      sourceY: 1100,
      direction: -1,
      instance: "skill-test",
    });
    const interrupted =
      !s.skills.active && s.doll.state.active && s.energy === paid;
    s.hp = 1;
    s.doll.reset();
    s.hurtAt = -999;
    s.damage(false, 1);
    const deathReset =
      !s.skills.active &&
      Object.values(s.skills.cooldowns).every((v) => v === 0);
    reset();
    s.pendingKeys.add("R");
    step(22);
    const airLimit = s.skills.riseUsed && !s.onGround;
    // Put a live, reward-free existing enemy in the uppercut band.
    const e = s.enemies[0];
    Object.assign(e, {
      x: 455,
      y: 1100,
      floor: 1100,
      minX: 350,
      maxX: 550,
      hp: 2,
      phase: "patrol",
      bound: 0,
      cool: 999,
    });
    reset();
    s.pendingKeys.add("R");
    step(20);
    const lifted = e.hp === 1 && e.liftVy !== undefined;
    step(110);
    const landed = e.liftVy === undefined && e.phase !== "strike";
    return { closed, interrupted, deathReset, airLimit, lifted, landed };
  });
  expect(r).toEqual({
    closed: true,
    interrupted: true,
    deathReset: true,
    airLimit: true,
    lifted: true,
    landed: true,
  });
});

test("difficulty settings, all boss hazards, locked warnings and cleanup", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#difficulty").selectOption("challenge");
  await page.locator('[data-action="new"]').click();
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").guardian.hp,
    ),
  ).toBe(64);
  const result = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    Object.assign(s, { x: 2650, y: 1100, hp: 5, hurtAt: 999 });
    const phases: string[] = [];
    const b = s.guardian;
    for (let i = 0; i < 120 * 55; i++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
      if (!phases.includes(b.phase)) phases.push(b.phase);
      if (i === 120 * 25) b.hp = b.maxHp / 2;
      if (i % 6 === 0) s.draw();
    }
    s.returnToCheckpoint();
    return {
      phases,
      hazards: s.guardian.hazards.length,
      wave: s.guardian.wave.length,
    };
  });
  for (const phase of [
    "charge",
    "slam",
    "crystal-warn",
    "crystal",
    "garden-warn",
    "garden",
    "radiance-warn",
    "radiance",
    "combo-gap",
  ])
    expect(result.phases).toContain(phase);
  expect(result.hazards).toBe(0);
  expect(result.wave).toBe(0);
});

test("skill preview exposes stepping, hazards and diagnostics without runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?action-skill");
  await expect(page.locator("h1")).toContainText("剑舞实验室");
  for (const scenario of [
    "combo",
    "branch",
    "rise",
    "bloom",
    "charge",
    "slam",
    "crystal",
    "garden",
    "radiance",
  ]) {
    await page.locator("#scenario").selectOption(scenario);
    await page.waitForTimeout(100);
    await expect(page.locator("#diagnostics")).toContainText("模拟");
  }
  await page.locator("#step").click();
  await page.locator("#phase").click();
  expect(errors).toEqual([]);
});

test("three real bloom pulses damage the boss independently and ordinary attacks retain the 85 ms point", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const result = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    Object.assign(s, {
      clock: 20,
      x: 2700,
      y: 1000,
      vx: 0,
      vy: 0,
      facing: 1,
      energy: 100,
      hurtAt: 999,
      dashAt: -999,
      onGround: false,
    });
    Object.assign(s.guardian, { x: 2770, phase: "bound", until: 999, hp: 10 });
    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        s.clock += 1 / 120;
        s.step(1 / 120);
      }
    };
    s.pendingKeys.add("F");
    step(60);
    const hp = s.guardian.hp;
    s.skills.reset();
    s.clearInput();
    s.y = 1100;
    s.vy = 0;
    s.attackAt = -999;
    s.guardian.hurtUntil = -999;
    s.pendingKeys.add("J");
    step(10);
    const before = s.guardian.hp;
    step(2);
    const after = s.guardian.hp;
    return { hp, before, after };
  });
  expect(result).toEqual({ hp: 7, before: 7, after: 5 });
});

test("skills on a moving platform, boss body blocking and ragdoll Shift arbitration", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const result = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const list = s.layout.platforms,
      index = list.findIndex((p: any) => p.moving),
      p = list[index];
    Object.assign(s, {
      x: p.x + p.w / 2,
      y: p.y,
      vx: 0,
      vy: 0,
      clock: 20,
      onGround: true,
      groundIndex: index,
      facing: 1,
      energy: 100,
      hurtAt: 999,
      dashAt: -999,
    });
    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        s.clock += 1 / 120;
        s.step(1 / 120);
        s.draw();
      }
    };
    s.pendingKeys.add("R");
    step(22);
    const platformLaunch = !s.onGround && s.vy < 0 && s.skills.riseUsed;
    s.resetAnimations();
    s.clearInput();
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    Object.assign(s, {
      x: 2700,
      y: 1100,
      vx: 0,
      vy: 0,
      facing: 1,
      energy: 100,
      onGround: true,
    });
    Object.assign(s.guardian, { x: 2800, phase: "bound", until: 999 });
    s.pendingKeys.add("Q");
    step(34);
    const bodyBlocked = s.x <= s.guardian.x - 48;
    s.skills.cancel();
    s.hurtAt = -999;
    s.dashAt = -999;
    s.damage(false, -1, {
      kind: "charge",
      direction: -1,
      sourceX: 2800,
      sourceY: 1100,
      instance: "shift-arbitration",
    });
    step(28);
    const dashAt = s.dashAt;
    s.pendingKeys.add("SHIFT");
    step(30);
    return {
      platformLaunch,
      bodyBlocked,
      recoveryNoDash: s.dashAt === dashAt,
      recovered: !s.doll.state.active,
    };
  });
  expect(result).toEqual({
    platformLaunch: true,
    bodyBlocked: true,
    recoveryNoDash: true,
    recovered: true,
  });
});

test("unobstructed branch consumes the final partial movement interval and reaches exactly 160 pixels", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const distance = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    Object.assign(s, {
      clock: 20,
      x: 400,
      y: 1100,
      vx: 0,
      vy: 0,
      onGround: true,
      facing: 1,
      energy: 100,
      hurtAt: -999,
      dashAt: -999,
    });
    s.pendingKeys.add("Q");
    for (let i = 0; i < 48; i++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    return s.x - 400;
  });
  expect(distance).toBeCloseTo(160, 6);
});
