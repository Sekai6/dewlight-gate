import { test, expect } from "@playwright/test";

test("round 6 support follows bounded platforms without stretching; recovery stays visual", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const r = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const actors = [
      s.art.actor,
      s.creatures.actors.find((a: any) => a.kind === "moss"),
      s.guardianArt.actor,
    ];
    let drift = 0,
      rigid = 0,
      grip = 0,
      clip = 0;
    let paused = true;
    for (const a of actors)
      for (const fps of [10, 20, 60])
        for (const dir of [-1, 1]) {
          a.reset();
          for (let i = 0; i < fps * 3; i++) {
            const t = i / fps,
              shift = Math.sin(t) * 15,
              moving = t % 1.5 < 1,
              sign = t < 1.5 ? dir : -dir;
            const input = {
              x: 500 + Math.sin(t * 2) * 25 + shift,
              y: 900 + Math.sin(t) * 8,
              clock: 20 + t,
              vx: moving ? sign * 60 : 0,
              vy: 0,
              facing: sign,
              grounded: true,
              action: moving ? "walk" : "idle",
              age: t,
              support: {
                id: "leaf",
                x: shift,
                y: 900 + Math.sin(t) * 8,
                left: 400 + shift,
                right: 600 + shift,
              },
            };
            a.draw(input);
            const p = a.snapshot();
            a.draw(input);
            paused &&= JSON.stringify(p) === JSON.stringify(a.snapshot());
            for (let j = 0; j < 2; j++) {
              if (p.contacts[j].planted)
                drift = Math.max(
                  drift,
                  Math.hypot(
                    p.contacts[j].x - p.feet[j].x,
                    p.contacts[j].y - p.feet[j].y,
                  ),
                );
            }
            if (a.kind === "hero")
              grip = Math.max(
                grip,
                Math.hypot(
                  p.hand.x - p.weaponBase.x,
                  p.hand.y - p.weaponBase.y,
                ),
              );
            for (const c of p.corners)
              clip = Math.max(
                clip,
                Math.abs(c.x) - p.extent,
                Math.abs(c.y) - p.extent,
              );
          }
        }
    const a = s.art.actor;
    const paths = new Set<string>();
    let controlAt = 0;
    s.resetAnimations();
    s.clock = 50;
    s.x = 400;
    s.y = 1100;
    s.hp = 5;
    s.hurtAt = -999;
    s.dashAt = -999;
    s.draw();
    s.damage(false, 1, {
      kind: "charge",
      sourceX: 350,
      sourceY: 1100,
      direction: 1,
      instance: "r6",
    });
    for (let i = 0; i < 280; i++) {
      s.clock += 1 / 120;
      s.step(1 / 120);
      s.draw();
      const p = a.snapshot();
      paths.add(p.recovery.state.path);
      if (!controlAt && !s.doll.state.active) controlAt = i / 120;
      rigid = Math.max(
        rigid,
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
      grip = Math.max(
        grip,
        Math.hypot(p.hand.x - p.weaponBase.x, p.hand.y - p.weaponBase.y),
      );
    }
    a.reset();
    return {
      drift,
      rigid,
      grip,
      clip,
      paused,
      controlAt,
      paths: [...paths],
      reset: a.snapshot().recovery.state.active,
    };
  });
  expect(r.drift).toBeLessThanOrEqual(3);
  expect(r.rigid).toBeLessThanOrEqual(0.01);
  expect(r.grip).toBeLessThanOrEqual(1);
  expect(r.clip).toBeLessThanOrEqual(0);
  expect(r.paused).toBe(true);
  expect(r.controlAt).toBeLessThanOrEqual(2.2);
  expect(r.paths).toContain("stand");
  expect(r.reset).toBe(false);
});

test("round 6 preview exposes separate support/recovery controls and bounded replays", async ({
  page,
}) => {
  await page.goto("/?action-a");
  await page.locator("#replay").selectOption("platform");
  await expect(page.locator("#diagnostics")).toContainText("anchors=");
  await page.locator("#layer-recovery").uncheck();
  await page.locator("#doll-kind").selectOption("charge");
  await page.locator("#replay").selectOption("edge");
  await expect(page.locator("#diagnostics")).toContainText("RECOVERY=");
  await page.locator("#pause").click();
  await expect(page.locator("#diagnostics")).toContainText("已暂停");
  const before = await page.locator("#diagnostics").textContent();
  await page.waitForTimeout(100);
  expect(await page.locator("#diagnostics").textContent()).toBe(before);
});
