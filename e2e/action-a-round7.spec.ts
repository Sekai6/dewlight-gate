import { test, expect } from "@playwright/test";

test("round 7 four actors keep bounded attention, rigid contacts and frozen diagnostics", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="new"]').click();
  const result = await page.evaluate(() => {
    const g = (window as any).dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    const actors = [
      s.art.actor,
      ...["moss", "moth"].map((k) =>
        s.creatures.actors.find((a: any) => a.kind === k),
      ),
      s.guardianArt.actor,
    ];
    let error = 0,
      finite = true,
      freeze = true,
      attention = 0;
    const counts = [];
    for (const actor of actors) {
      for (const fps of [10, 20, 60])
        for (const facing of [-1, 1]) {
          actor.reset();
          for (let i = 0; i < fps * 4; i++) {
            const t = i / fps,
              action =
                t < 1
                  ? "walk"
                  : t < 2
                    ? actor.kind === "hero"
                      ? "slash"
                      : "strike"
                    : "idle";
            const input = {
              x: 500,
              y: 900,
              clock: 20 + t,
              age: t % 1,
              action,
              instance: Math.floor(t),
              facing,
              vx: t < 1 ? 100 * facing : 0,
              grounded: actor.kind !== "moth",
              support: { id: "leaf", x: 0, y: 900, left: 400, right: 600 },
              intentTarget: {
                id: "threat",
                x: 500 + facing * (t < 3 ? 120 : -120),
                y: 820,
                threat: true,
              },
            };
            actor.draw(input);
            const snap = actor.snapshot();
            error = Math.max(
              error,
              ...snap.constraints.map((c: any) => c.error),
            );
            attention = Math.max(attention, Math.abs(snap.intent.head));
            finite =
              finite &&
              Number.isFinite(snap.impulse.hip) &&
              Number.isFinite(snap.intent.head);
            actor.draw(input);
            freeze =
              freeze &&
              JSON.stringify(snap) === JSON.stringify(actor.snapshot());
          }
        }
      counts.push({ kind: actor.kind, parts: actor.snapshot().parts });
    }
    return { error, finite, freeze, attention, counts };
  });
  expect(result.error).toBeLessThan(0.01);
  expect(result.finite).toBe(true);
  expect(result.freeze).toBe(true);
  expect(result.attention).toBeGreaterThan(0.01);
  expect(result.attention).toBeLessThanOrEqual((20 * Math.PI) / 180);
  expect(result.counts).toHaveLength(4);
});

test("round 7 preview exposes module controls and attention replay", async ({
  page,
}) => {
  await page.goto("/?action-a");
  await expect(page.locator("#module-intent")).toBeVisible();
  await page.locator("#attention").selectOption("orbit");
  await expect(page.locator("#diagnostics")).toContainText("INTENT=");
  for (const name of ["contact", "impulse", "intent"]) {
    await page.locator(`#module-${name}`).uncheck();
    await page.locator(`#module-${name}`).check();
  }
});
