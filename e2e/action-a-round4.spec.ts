import { test, expect } from "@playwright/test";

test("ACTION-A round 4 arm lengths, grip, contact and interruption hold at 10/20/60 fps", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启旅程" }).click();
  const result = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const a = s.art.actor;
    let error = 0,
      grip = 0,
      contact = Infinity,
      bladeMin = Infinity,
      bladeMax = 0;
    for (const fps of [10, 20, 60])
      for (const facing of [-1, 1]) {
        a.reset();
        let clock = s.clock + 1,
          x = 500;
        for (let n = 0; n < fps * 3; n++) {
          const t = n / fps,
            segment = Math.floor(t / 0.4),
            age = t % 0.4;
          clock += 1 / fps;
          x += (facing * 120) / fps;
          const action =
            t > 1.6 && t < 1.9
              ? "hurt"
              : segment % 2
                ? "rising-slash"
                : "slash";
          a.draw({
            x,
            y: 1100,
            clock,
            action,
            age,
            instance: segment,
            facing,
            vx: facing * 120,
            hitDirection: -facing,
            grounded: t > 0.8,
          });
          const p = a.snapshot(),
            arm = p.bones.arm,
            fore = p.bones.fore,
            w = p.bones.weapon;
          error = Math.max(
            error,
            Math.abs(Math.hypot(fore.x - arm.x, fore.y - arm.y) / 12 - 1),
            Math.abs(Math.hypot(w.x - fore.x, w.y - fore.y) / 11 - 1),
          );
          grip = Math.max(
            grip,
            Math.hypot(p.hand.x - p.weaponBase.x, p.hand.y - p.weaponBase.y),
          );
          const length = Math.hypot(
            p.weaponTip.x - p.weaponBase.x,
            p.weaponTip.y - p.weaponBase.y,
          );
          bladeMin = Math.min(bladeMin, length);
          bladeMax = Math.max(bladeMax, length);
        }
        a.reset();
        a.draw({
          x: 500,
          y: 1100,
          clock: clock + 1,
          action: "slash",
          age: 0.085,
          instance: "contact",
          facing,
          vx: 0,
          grounded: true,
        });
        const p = a.snapshot();
        contact = Math.min(contact, (p.weaponTip.x - 500) * facing);
      }
    return {
      error,
      grip,
      contact,
      bladeVariation: (bladeMax - bladeMin) / bladeMin,
    };
  });
  expect(result.error).toBeLessThanOrEqual(0.01);
  expect(result.grip).toBeLessThanOrEqual(1);
  expect(result.bladeVariation).toBeLessThanOrEqual(0.01);
  expect(result.contact).toBeGreaterThan(25);
});

test("ACTION-A round 4 replay presets and constraint diagnostics remain development-only tools", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?action-a");
  for (const replay of ["combo", "moving", "air", "hurt", "enemy"]) {
    await page.locator("#replay").selectOption(replay);
    await page.locator("#step").click();
    await expect(page.locator("#diagnostics")).toContainText("gripError=");
  }
  expect(errors).toEqual([]);
});
