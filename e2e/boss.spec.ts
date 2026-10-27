import { test, expect } from "@playwright/test";
test("root waves and arena camera freeze in the menu and resume afterwards", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    s.x = 2500;
    s.y = 1100;
    s.guardian.phase = "recover";
    s.guardian.until = s.clock + 2;
    s.guardian.wave = [{ x: 2800, dir: -1, hit: false }];
    s.draw();
  });
  await page.keyboard.press("Tab");
  const snapshot = () =>
    page.evaluate(() => {
      const s = (window as any).dewlight.scene.getScene("journey");
      return {
        clock: s.clock,
        boss: JSON.stringify(s.guardian),
        camera: [s.framing.x, s.framing.y, s.framing.zoom],
      };
    });
  const before = await snapshot();
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    for (let n = 0; n < 120; n++) s.update(0, 16.67);
  });
  expect(await snapshot()).toEqual(before);
  await page.keyboard.press("Tab");
  const x = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.clock += 1 / 120;
    s.step(1 / 120);
    return s.guardian.wave[0].x;
  });
  expect(x).toBeLessThan(2800);
});
test("dash protection works against charge and held attack deals damage during ordinary phases", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    s.x = 2700;
    s.y = 1100;
    s.onGround = true;
    s.guardian.phase = "charge";
    s.guardian.x = 2765;
    s.guardian.facing = -1;
    s.guardian.chargeEnd = 2500;
    s.guardian.until = s.clock + 1;
    s.facing = 1;
    s.hurtAt = -999;
  });
  await page.keyboard.press("Shift");
  const hp = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    for (let n = 0; n < 20; n++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    return s.hp;
  });
  expect(hp).toBe(5);
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.clearInput();
    s.guardian.phase = "stalk";
    s.guardian.until = s.clock + 3;
    s.guardian.x = 2800;
    s.x = 2720;
    s.y = 1100;
    s.vx = 0;
    s.vy = 0;
    s.facing = 1;
    s.dashAt = -999;
  });
  await page.keyboard.down("j");
  const combat = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey"),
      before = s.guardian.hp;
    for (let n = 0; n < 120; n++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    return {
      damage: before - s.guardian.hp,
      phase: s.guardian.phase,
      x: s.x,
      clock: s.clock,
      attackAt: s.attackAt,
      held: s.keys.J.isDown,
      arena: !!s.arena,
    };
  });
  await page.keyboard.up("j");
  expect(combat.phase).toBe("stalk");
  expect(combat.damage).toBeGreaterThanOrEqual(2);
});
test("arena restart clears hazards, restores resources and preserves light progress", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    s.x = 2500;
    s.y = 1100;
    s.clock += 1 / 120;
    s.step(1 / 120);
    s.hp = 2;
    s.energy = 5;
    s.guardian.wave = [{ x: 2500, dir: 1, hit: false }];
    s.keys.J.isDown = true;
  });
  await page.keyboard.press("r");
  const state = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return {
      x: s.x,
      hp: s.hp,
      energy: s.energy,
      phase: s.guardian.phase,
      waves: s.guardian.wave.length,
      lights: s.layout.lenses.length,
      held: s.keys.J.isDown,
    };
  });
  expect(state).toEqual({
    x: 2310,
    hp: 5,
    energy: 100,
    phase: "sleep",
    waves: 0,
    lights: 4,
    held: false,
  });
});
test("legacy first monument keeps completion and later bead collections", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "dewlight.save.v2",
      JSON.stringify({
        version: 2,
        checkpoint: 1,
        beads: ["bead-46-0"],
        stones: [0],
        logs: [],
        elapsed: 123,
        lenses: [],
        trials: [],
        angles: {},
        position: null,
      }),
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "继续旅程" }).click();
  const state = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return {
      phase: s.guardian.phase,
      x: s.x,
      exists: s.beads.some((b: any) => b.id === "bead-46-0"),
      collected: s.collected.has("bead-46-0"),
      beads: [...s.collected],
    };
  });
  expect(state).toEqual({
    phase: "defeated",
    x: 3255,
    exists: true,
    collected: true,
    beads: ["bead-46-0"],
  });
});
test("guardian blocks the monument and defeat retries at the arena without losing lights", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    s.x = 3320;
    s.y = 1100;
    s.keys.E._justDown = true;
    s.clock += 1 / 120;
    s.step(1 / 120);
    const blocked = !JSON.parse(
      localStorage.getItem("dewlight.save.v2")!,
    ).stones.includes(0);
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    s.x = 2500;
    s.y = 1100;
    s.clock += 1 / 120;
    s.step(1 / 120);
    s.hp = 1;
    s.damage(true);
    return {
      blocked,
      x: s.x,
      hp: s.hp,
      energy: s.energy,
      phase: s.guardian.phase,
      lenses: s.layout.lenses.length,
    };
  });
  expect(result).toEqual({
    blocked: true,
    x: 2260,
    hp: 5,
    energy: 100,
    phase: "sleep",
    lenses: 4,
  });
});
test("first guardian has a safe opening, freezes in menus, can be defeated and saved", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").guardian.phase,
    ),
  ).toBe("sleep");
  await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    for (const p of s.layout.prisms.filter((p: any) => p.room === 0))
      s.activatePrism(p);
    s.x = 2500;
    s.y = 1100;
    s.vx = 0;
    s.vy = 0;
    s.onGround = true;
    s.clock += 1 / 120;
    s.step(1 / 120);
    s.draw();
  });
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").guardian.phase,
    ),
  ).toBe("intro");
  await page.keyboard.press("Tab");
  const before = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    return JSON.stringify(s.guardian);
  });
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    for (let n = 0; n < 120; n++) s.update(0, 16.67);
  });
  expect(
    await page.evaluate(() =>
      JSON.stringify(
        (window as any).dewlight.scene.getScene("journey").guardian,
      ),
    ),
  ).toBe(before);
  await page.keyboard.press("Tab");
  const result = await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    // Chase, dodge warning, and punish using actual inputs without moving the actor by hand.
    for (let n = 0; n < 120 * 120 && s.guardian.hp > 0; n++) {
      const b = s.guardian,
        dx = b.x - s.x;
      s.keys.A.isDown = dx < -65;
      s.keys.D.isDown = dx > 65;
      s.facing = dx > 0 ? 1 : -1;
      if ((b.phase === "warn" || b.phase === "slam-warn") && s.onGround)
        s.keys.SPACE._justDown = true;
      if (n % 48 === 0) s.keys.J._justDown = true;
      if (n % 200 === 0) s.keys.K._justDown = true;
      s.clock += 1 / 120;
      s.step(1 / 120);
    }
    s.keys.A.isDown = false;
    s.keys.D.isDown = false;
    return { hp: s.guardian.hp, phase: s.guardian.phase };
  });
  expect(result).toEqual({ hp: 0, phase: "defeated" });
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.x = 3320;
    s.y = 1100;
    s.vx = 0;
    s.vy = 0;
    s.keys.E._justDown = true;
    s.clock += 1 / 120;
    s.step(1 / 120);
  });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dewlight.save.v2")!),
  );
  expect(saved.stones).toContain(0);
  expect(
    saved.beads.filter((id: string) => id === "boss-dew-crown"),
  ).toHaveLength(1);
  await page.reload();
  await page.getByRole("button", { name: "继续旅程" }).click();
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").guardian.phase,
    ),
  ).toBe("defeated");
  await page.evaluate(() => {
    const s = (window as any).dewlight.scene.getScene("journey");
    s.x = 3580;
    s.y = 1100;
    s.vx = 0;
    s.keys.E._justDown = true;
    s.clock += 1 / 120;
    s.step(1 / 120);
  });
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").x,
    ),
  ).toBeGreaterThan(12000);
  await page.keyboard.press("e");
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").x,
    ),
  ).toBeGreaterThan(3700);
  expect(
    await page.evaluate(
      () => (window as any).dewlight.scene.getScene("journey").x,
    ),
  ).toBeLessThan(4000);
});
