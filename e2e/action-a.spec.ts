import { test, expect } from "@playwright/test";

test("ACTION-A round 3 layers keep independent clocks, rigid grip and reaction priority", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const a = s.art.actor;
    a.reset();
    let clock = s.clock + 1,
      x = 500,
      maxGrip = 0,
      minBlade = Infinity,
      maxBlade = 0;
    const frames: any[] = [];
    for (let n = 0; n < 60; n++) {
      clock += 1 / 120;
      x += 120 / 120;
      a.draw({
        x,
        y: 1100,
        clock,
        action: n < 45 ? "slash" : "hurt",
        age: n < 45 ? n / 120 : (n - 45) / 120,
        instance: n < 45 ? "attack" : "hit",
        facing: 1,
        vx: 120,
        grounded: true,
      });
      const p = a.snapshot();
      const wrist = p.bones.weapon;
      maxGrip = Math.max(
        maxGrip,
        Math.hypot(
          p.weaponBase.x - (x + wrist.x),
          p.weaponBase.y - (1100 + wrist.y),
        ),
      );
      const length = Math.hypot(
        p.weaponTip.x - p.weaponBase.x,
        p.weaponTip.y - p.weaponBase.y,
      );
      minBlade = Math.min(minBlade, length);
      maxBlade = Math.max(maxBlade, length);
      frames.push(p);
    }
    const before = a.snapshot();
    a.draw({
      x,
      y: 1100,
      clock,
      action: "hurt",
      age: 14 / 120,
      instance: "hit",
      facing: 1,
      vx: 120,
      grounded: true,
    });
    const paused = a.snapshot();
    a.reset();
    return {
      maxGrip,
      bladeVariation: maxBlade - minBlade,
      first: frames[20],
      last: frames[59],
      pauseEqual: JSON.stringify(before) === JSON.stringify(paused),
      resetLayers: a.snapshot().layers,
    };
  });
  expect(result.maxGrip).toBeLessThan(0.001);
  expect(result.bladeVariation).toBeLessThan(0.001);
  expect(result.first.layers[0].age).not.toEqual(result.first.layers[1].age);
  expect(result.last.layers[1].weight).toBe(0);
  expect(result.last.layers[2].weight).toBe(1);
  expect(result.pauseEqual).toBe(true);
  expect(
    result.resetLayers.every((l: any) => l.age === 0 && l.weight === 0),
  ).toBe(true);
});

test("ACTION-A development preview exposes layers and same-input round 3 baseline", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?action-a");
  await expect(page.locator("#layer-combat")).toBeChecked();
  await page.locator("#action").selectOption("slash");
  await page.locator("#moving-attack").check();
  await page.locator("#pause").click();
  await page.locator("#step").click();
  await expect(page.locator("#diagnostics")).toContainText("combat:");
  const compare = page.locator("#compare");
  if (await compare.isEnabled()) await compare.check();
  await page.locator("#layer-follow").uncheck();
  await page.locator("#step").click();
  expect(errors).toEqual([]);
});

test("ACTION-A round 3 low-FPS interruptions split trails and preserve connected affine joints", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const actors = [
      s.art.actor,
      ...["moss", "moth"].map((kind) =>
        s.creatures.actors.find((a: any) => a.kind === kind),
      ),
      s.guardianArt.actor,
    ];
    let jointError = 0,
      rigidError = 0,
      scaleOK = true,
      trailMax = 0;
    for (const a of actors) {
      a.reset();
      let clock = s.clock + 1;
      for (const action of [
        "windup",
        "strike",
        "recover",
        "slash",
        "hurt",
        "slam-warn",
        "slam",
        "defeat",
      ]) {
        for (let n = 0; n < 12; n++) {
          clock += 1 / 10;
          a.draw({
            x: 500,
            y: 1100,
            clock,
            facing: n % 2 ? -1 : 1,
            action,
            age: n / 10,
            instance: action,
            vx: 0,
            grounded: true,
          });
          const snap = a.snapshot();
          trailMax = Math.max(trailMax, snap.trailSamples);
          for (const [joint, parent] of [
            ["shoulderFront", "arm"],
            ["elbowFront", "fore"],
            ["shoulderBack", "armBack"],
            ["elbowBack", "foreBack"],
          ]) {
            const p = snap.bones[joint],
              q = snap.bones[parent];
            jointError = Math.max(jointError, Math.hypot(p.x - q.x, p.y - q.y));
          }
          const w = snap.bones.weapon;
          rigidError = Math.max(
            rigidError,
            Math.abs(Math.hypot(w.a, w.b) - 1),
            Math.abs(Math.hypot(w.c, w.d) - 1),
            Math.abs(w.a * w.c + w.b * w.d),
          );
          const pose = a.composed.pose;
          for (const name of ["hip", "torso", "head"]) {
            const p = pose[name];
            scaleOK &&=
              p.scaleX >= 0.85 &&
              p.scaleX <= 1.15 &&
              p.scaleY >= 0.85 &&
              p.scaleY <= 1.15;
          }
        }
      }
    }
    return { jointError, rigidError, scaleOK, trailMax };
  });
  expect(result.jointError).toBeLessThan(0.001);
  expect(result.rigidError).toBeLessThan(0.001);
  expect(result.trailMax).toBeLessThanOrEqual(1);
  expect(result.scaleOK).toBe(true);
});
test("ACTION-A planted feet stay within 3 world pixels through walking, running and reversal", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const report = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const actor = s.art.actor;
    actor.reset();
    let clock = s.clock + 1,
      x = 600,
      maxDrift = 0,
      samples = 0;
    let previous: any = null;
    for (const facing of [1, -1])
      for (const speed of [120, 264])
        for (let n = 0; n < 180; n++) {
          clock += 1 / 120;
          x += (facing * speed) / 120;
          actor.draw({
            x,
            y: 1100,
            clock,
            facing,
            action: speed === 120 ? "walk" : "run",
            age: clock,
            vx: facing * speed,
            grounded: true,
          });
          const now = actor.snapshot();
          now.contacts.forEach((c: any, i: number) => {
            if (
              c.planted &&
              previous?.contacts[i].planted &&
              c.x === previous.contacts[i].x &&
              c.y === previous.contacts[i].y
            ) {
              maxDrift = Math.max(
                maxDrift,
                Math.hypot(now.feet[i].x - c.x, now.feet[i].y - c.y),
                Math.hypot(
                  now.feet[i].x - previous.feet[i].x,
                  now.feet[i].y - previous.feet[i].y,
                ),
              );
              samples++;
            }
          });
          previous = now;
        }
    return { maxDrift, samples };
  });
  expect(report.samples).toBeGreaterThan(400);
  expect(report.maxDrift).toBeLessThanOrEqual(3);
});

test("ACTION-A blade points into the hit region and all rigs remain finite across action interruptions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const game = (window as any).dewlight,
      s = game.scene.getScene("journey");
    game.loop.sleep();
    const actor = s.art.actor;
    const hits: number[] = [];
    for (const facing of [1, -1])
      for (const action of ["slash", "rising-slash", "air-slash"]) {
        actor.reset();
        actor.draw({
          x: 500,
          y: 1100,
          clock: 1,
          facing,
          action,
          age: 0,
          vx: 0,
          grounded: action !== "air-slash",
        });
        actor.draw({
          x: 500,
          y: 1100,
          clock: 1.085,
          facing,
          action,
          age: 0.085,
          vx: 0,
          grounded: action !== "air-slash",
        });
        hits.push((actor.snapshot().weaponTip.x - 500) * facing);
      }
    const rigs = [
      actor,
      s.creatures.actors.find((a: any) => a.kind === "moss"),
      s.creatures.actors.find((a: any) => a.kind === "moth"),
      s.guardianArt.actor,
    ];
    let finite = true,
      clock = 5;
    for (const a of rigs)
      for (const action of [
        "idle",
        "walk",
        "run",
        "launch",
        "rise",
        "apex",
        "fall",
        "land",
        "slash",
        "dash",
        "bind",
        "hurt",
        "bound",
        "windup",
        "strike",
        "recover",
        "slam-warn",
        "slam",
        "defeat",
      ]) {
        a.reset();
        for (let n = 0; n < 30; n++) {
          clock += 1 / 60;
          a.draw({
            x: 500 + n,
            y: 1100,
            clock,
            facing: 1,
            action,
            age: n / 60,
            vx: 60,
            grounded: !["launch", "rise", "apex", "fall"].includes(action),
          });
          const p = a.snapshot();
          finite &&= Object.values(p.bones).every((t: any) =>
            Object.values(t).every((v) => Number.isFinite(v)),
          );
        }
      }
    return { hits, finite };
  });
  expect(Math.min(...result.hits)).toBeGreaterThan(25);
  expect(result.finite).toBe(true);
});
test("ACTION-A pose, springs, trails and contacts freeze in menus and reset at checkpoints", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.keyboard.press("j");
  await page.waitForTimeout(120);
  await page.keyboard.press("Tab");
  const snapshot = () =>
    page.evaluate(() => {
      const s = (window as any).dewlight.scene.getScene("journey");
      return {
        hero: s.art.actor.snapshot(),
        boss: s.guardianArt.actor.snapshot(),
        enemies: s.creatures.actors.map((a: any) => a.snapshot()),
      };
    });
  const before = await snapshot();
  await page.waitForTimeout(350);
  expect(await snapshot()).toEqual(before);
  await page.getByRole("button", { name: "回到检查点", exact: true }).click();
  await page.keyboard.press("Tab");
  const after = await snapshot();
  expect(after.hero.epoch).toBeGreaterThan(before.hero.epoch);
});
test("ACTION-A preview selects all actors, pauses and steps without exposing gameplay", async ({
  page,
}) => {
  await page.goto("/?action-a");
  await expect(page.locator("header")).toContainText("ACTION-A");
  for (const actor of ["hero", "moss", "moth", "guardian"]) {
    await page.locator("#actor").selectOption(actor);
    await page.locator("#action").selectOption("strike");
    await expect(page.locator("#diagnostics")).toContainText(actor);
  }
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.waitForTimeout(100);
  const frozen = await page.locator("#diagnostics").textContent();
  await page.waitForTimeout(150);
  expect(await page.locator("#diagnostics").textContent()).toBe(frozen);
  await page.getByRole("button", { name: "步进 1/60 秒" }).click();
  await expect(page.locator("#diagnostics")).not.toHaveText(frozen!);
  expect(await page.evaluate(() => "dewlight" in window)).toBe(false);
});

test("ACTION-A revisiting all gardens does not grow texture or display object pools", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const visit = () => {
      for (let room = 0; room < 6; room++) {
        const p = s.layout.platforms.find(
          (p: any) => p.room === room && p.y > 700,
        );
        s.x = p.x + 60;
        s.y = p.y;
        s.vx = 0;
        s.vy = 0;
        s.region = Math.floor(room / 2);
        s.clock += 0.2;
        s.draw();
      }
    };
    const count = () => {
      let objects = 0;
      const add = (o: any) => {
        objects++;
        o.list?.forEach(add);
      };
      s.children.list.forEach(add);
      return { objects, textures: g.textures.getTextureKeys().length };
    };
    visit();
    const before = count();
    for (let i = 0; i < 8; i++) visit();
    return { before, after: count() };
  });
  expect(result.after).toEqual(result.before);
});

test("ACTION-A support anchors follow moving platforms and stop-turn feet remain connected", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u5f00\u542f\u65c5\u7a0b" }).click();
  const result = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const a = s.art.actor;
    a.reset();
    let drift = 0,
      disconnect = 0,
      previous: any,
      x = 500,
      clock = 10;
    const support = { id: "moving", x: 500, y: 800 };
    for (let n = 0; n < 240; n++) {
      const y = 800 + Math.sin(n / 30) * 20;
      x += 0.3;
      clock += 1 / 120;
      support.x = x;
      support.y = y;
      a.draw({
        x,
        y,
        clock,
        facing: n < 120 ? 1 : -1,
        action: "idle",
        age: clock,
        vx: 0,
        grounded: true,
        support,
      });
      const now = a.snapshot();
      now.contacts.forEach((c: any, i: number) => {
        if (c.planted)
          drift = Math.max(
            drift,
            Math.hypot(now.feet[i].x - c.x, now.feet[i].y - c.y),
          );
        disconnect = Math.max(
          disconnect,
          Math.abs(now.hips[i].y - now.bones.hip.y),
        );
      });
      previous = now;
    }
    const gait = previous.gait;
    return { drift, disconnect, gait };
  });
  expect(result.drift).toBeLessThanOrEqual(3);
  expect(result.disconnect).toBeLessThan(0.001);
  expect(result.gait).toBeLessThan(0.001);
});

test("ACTION-A attack identity survives landing and paused replay without a second windup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u5f00\u542f\u65c5\u7a0b" }).click();
  const result = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const a = s.art.actor;
    a.reset();
    const base = {
      x: 500,
      y: 900,
      clock: 10,
      facing: 1,
      action: "slash",
      age: 0,
      vx: 140,
      grounded: false,
      instance: "attack:1",
    };
    a.draw(base);
    a.draw({ ...base, clock: 10.1, age: 0.1 });
    a.draw({ ...base, clock: 10.11, age: 0.11, grounded: true, moving: true });
    const landed = a.snapshot();
    a.draw({ ...base, clock: 10.11, age: 0.11, grounded: true, moving: true });
    return { landed, paused: a.snapshot() };
  });
  expect(result.landed.action).toBe("slash");
  expect(result.landed.blendWeight).toBe(1);
  expect(result.landed.stage).toBe("release");
  expect(result.landed.airWeight).toBeGreaterThan(0.5);
  expect(result.paused).toEqual(result.landed);
});

test("ACTION-A all authored poses fit composite surfaces throughout attacks and interruptions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u5f00\u542f\u65c5\u7a0b" }).click();
  const report = await page.evaluate(async () => {
    const { ActionActor } = await import("/src/action-a/actor.ts" as string);
    const { ACTIONS, getClip } = await import(
      "/src/action-a/rigs.ts" as string
    );
    const game = (window as any).dewlight;
    game.loop.sleep();
    const scene = game.scene.getScenes(true)[0];
    let overflow = 0;
    for (const kind of ["hero", "moss", "moth", "guardian"]) {
      const a = new ActionActor(scene, kind);
      let clock = 0;
      for (const action of ACTIONS) {
        a.reset();
        const d = getClip(a.rig, action).duration;
        for (let frame = 0; frame <= 30; frame++) {
          const age = (frame * d) / 30;
          clock += 0.02;
          a.draw({
            x: 500,
            y: 360,
            clock,
            facing: 1,
            action,
            age,
            vx: 0,
            grounded: !["rise", "fall", "air-slash"].includes(action),
          });
          const s = a.snapshot();
          for (const p of s.corners)
            overflow = Math.max(
              overflow,
              Math.abs(p.x) - s.extent,
              Math.abs(p.y) - s.extent,
            );
        }
      }
    }
    return overflow;
  });
  expect(report).toBeLessThanOrEqual(0);
});

test("ACTION-A stopping at different gait phases settles the swing foot without a snap", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).dewlight);
  const max = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const a = s.art.actor;
    let max = 0;
    for (let stop = 15; stop < 100; stop += 3) {
      a.reset();
      let x = 500,
        previous: any;
      for (let n = 0; n < stop + 16; n++) {
        const vx = n < stop ? 264 : 0;
        x += vx / 120;
        a.draw({
          x,
          y: 1100,
          clock: 10 + n / 120,
          facing: n < stop ? 1 : -1,
          action: vx ? "run" : "idle",
          age: n / 120,
          vx,
          grounded: true,
        });
        const now = a.snapshot();
        if (n >= stop && previous)
          now.feet.forEach((p: any, i: number) => {
            max = Math.max(
              max,
              Math.hypot(p.x - previous.feet[i].x, p.y - previous.feet[i].y),
            );
          });
        previous = now;
      }
    }
    return max;
  });
  expect(max).toBeLessThanOrEqual(3);
});
