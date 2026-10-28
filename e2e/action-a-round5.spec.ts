import { test, expect } from "@playwright/test";

test("ACTION-A round 5 preserves two airborne segments, constrained recovery and low-FPS trails", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const report = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const a = s.art.actor;
    const identities: string[] = [],
      trails: number[] = [];
    let rigid = 0,
      grip = 0,
      drift = 0,
      elbowSide = -Infinity;
    let recovery = false,
      paused = true,
      reset = true;
    for (const fps of [10, 20, 60])
      for (const facing of [-1, 1])
        for (const segment of [1, 2]) {
          a.reset();
          const base = {
            x: 500,
            y: 900,
            clock: 10,
            facing,
            grounded: false,
            action: segment === 1 ? "slash" : "rising-slash",
            attackSegment: segment,
            instance: `attack:${segment}`,
            age: 0,
            vx: 0,
            vy: -150,
          };
          a.draw(base);
          for (let n = 1; n <= Math.ceil(fps * 0.5); n++) {
            const age = n / fps;
            const input = {
              ...base,
              clock: 10 + age,
              age,
              grounded: age >= 0.15,
              vy: age < 0.15 ? -150 : 0,
              action: age < 0.38 ? base.action : "idle",
              instance: age < 0.38 ? base.instance : undefined,
            };
            a.draw(input);
            const p = a.snapshot(),
              arm = p.bones.arm,
              elbow = p.bones.fore,
              hand = p.bones.weapon;
            rigid = Math.max(
              rigid,
              Math.abs(Math.hypot(arm.x - elbow.x, arm.y - elbow.y) / 12 - 1),
              Math.abs(Math.hypot(hand.x - elbow.x, hand.y - elbow.y) / 11 - 1),
            );
            grip = Math.max(
              grip,
              Math.hypot(p.hand.x - p.weaponBase.x, p.hand.y - p.weaponBase.y),
            );
            elbowSide = Math.max(
              elbowSide,
              (hand.x - arm.x) * (elbow.y - arm.y) -
                (hand.y - arm.y) * (elbow.x - arm.x),
            );
            p.contacts.forEach((c: any, i: number) => {
              if (c.planted)
                drift = Math.max(
                  drift,
                  Math.hypot(c.x - p.feet[i].x, c.y - p.feet[i].y),
                );
            });
            if (age >= 0.19 && age <= 0.21) {
              identities.push(p.action);
              trails.push(p.trailSamples);
            }
            if (age >= 0.38 && p.combatRecovery.weight > 0)
              recovery ||=
                p.combatRecovery.age >= 0.38 &&
                p.combatRecovery.action === base.action;
            a.draw(input);
            paused &&= JSON.stringify(a.snapshot()) === JSON.stringify(p);
          }
          a.reset();
          const p = a.snapshot();
          reset &&=
            p.trailSamples === 0 &&
            p.contacts.every((c: any) => c.weight === 0) &&
            p.pelvisOffset.x === 0;
        }
    const moth = s.creatures.actors.find((a: any) => a.kind === "moth");
    moth.reset();
    for (let n = 0; n < 20; n++)
      moth.draw({
        x: 500 + n,
        y: 850,
        clock: 20 + n / 60,
        facing: 1,
        grounded: true,
        action: "walk",
        age: n / 60,
        vx: 60,
        reduced: true,
      });
    const flight = moth.snapshot();
    return {
      identities,
      trails,
      rigid,
      grip,
      drift,
      elbowSide,
      recovery,
      paused,
      reset,
      flightSupported: flight.contacts.some(
        (c: any) => c.planted || c.weight > 0,
      ),
      flightGait: flight.gait,
    };
  });
  expect(report.identities).toContain("slash");
  expect(report.identities).toContain("rising-slash");
  expect(Math.min(...report.trails)).toBeGreaterThan(2);
  expect(report.rigid).toBeLessThanOrEqual(0.01);
  expect(report.grip).toBeLessThanOrEqual(1);
  expect(report.drift).toBeLessThanOrEqual(3);
  expect(report.elbowSide).toBeLessThan(0);
  expect(report.recovery && report.paused && report.reset).toBe(true);
  expect(report.flightSupported).toBe(false);
  expect(report.flightGait).toBe(0);
});
