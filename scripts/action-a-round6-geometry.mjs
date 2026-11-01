import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const b = await chromium.launch();
try {
  const p = await b.newPage();
  await p.goto("http://127.0.0.1:5173");
  await p.locator('[data-action="new"]').click();
  const report = await p.evaluate(() => {
    const g = window.dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    let clip = 0,
      grip = 0,
      length = 0,
      footDrift = 0,
      finite = true;
    const paths = {};
    let samples = 0;
    for (const fps of [10, 20, 60, 120])
      for (const facing of [-1, 1])
        for (const kind of ["ground", "flying", "charge", "wave"]) {
          s.resetAnimations();
          s.clearInput();
          s.effects.reset();
          s.clock = 20;
          s.x = 400;
          s.y = 1100;
          s.vx = 0;
          s.vy = 0;
          s.hp = 5;
          s.hurtAt = -999;
          s.dashAt = -999;
          s.facing = facing;
          s.draw();
          s.damage(false, 1, {
            kind,
            sourceX: 350,
            sourceY: 1100,
            direction: 1,
            instance: `geometry:${fps}:${facing}:${kind}`,
          });
          for (let tick = 1; tick <= 300; tick++) {
            s.clock += 1 / 120;
            s.step(1 / 120);
            if (tick % (120 / fps) !== 0) continue;
            s.draw();
            const q = s.art.actor.snapshot();
            samples++;
            const route = q.recovery.state.path;
            paths[route] = (paths[route] ?? 0) + 1;
            grip = Math.max(
              grip,
              Math.hypot(q.hand.x - q.weaponBase.x, q.hand.y - q.weaponBase.y),
            );
            length = Math.max(
              length,
              Math.abs(
                Math.hypot(
                  q.bones.arm.x - q.bones.fore.x,
                  q.bones.arm.y - q.bones.fore.y,
                ) /
                  12 -
                  1,
              ),
              Math.abs(
                Math.hypot(
                  q.bones.fore.x - q.bones.weapon.x,
                  q.bones.fore.y - q.bones.weapon.y,
                ) /
                  11 -
                  1,
              ),
            );
            for (const c of q.corners) {
              clip = Math.max(
                clip,
                Math.abs(c.x) - q.extent,
                Math.abs(c.y) - q.extent,
              );
              finite &&= Number.isFinite(c.x) && Number.isFinite(c.y);
            }
            q.contacts.forEach((c, i) => {
              if (c.planted)
                footDrift = Math.max(
                  footDrift,
                  Math.hypot(c.x - q.feet[i].x, c.y - q.feet[i].y),
                );
            });
          }
        }
    return {
      samples,
      clip,
      grip,
      relativeArmLengthError: length,
      footDrift,
      finite,
      paths,
    };
  });
  writeFileSync(
    "artifacts/action-a-round6/geometry.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  if (
    report.clip > 0 ||
    report.grip > 1 ||
    report.relativeArmLengthError > 0.01 ||
    report.footDrift > 3 ||
    !report.finite
  )
    process.exitCode = 1;
} finally {
  await b.close();
}
