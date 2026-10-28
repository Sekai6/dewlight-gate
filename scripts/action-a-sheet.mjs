import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const output = `${process.env.ACTION_A_OUTPUT || "artifacts/action-a"}/sheets`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.dewlight);
  const sheets = await page.evaluate(async () => {
    const { ActionActor } = await import("/src/action-a/actor.ts"),
      { getClip } = await import("/src/action-a/rigs.ts");
    const g = window.dewlight,
      s = g.scene.getScene("journey");
    g.loop.sleep();
    s.children.list.forEach((o) => o.setVisible(false));
    s.cameras.main.removeBounds();
    s.cameras.main.setZoom(1).setScroll(0, 0);
    const result = {};
    for (const kind of ["hero", "moss", "moth", "guardian"]) {
      s.cameras.main
        .setOrigin(0.5, 0.5)
        .setViewport(0, 0, 220, 240)
        .setZoom(kind === "guardian" ? 1 : 2)
        .centerOn(110, kind === "guardian" ? 135 : 175);
      const actions =
        kind === "hero"
          ? [
              "idle",
              "walk",
              "run",
              "launch",
              "rise",
              "apex",
              "fall",
              "land",
              "slash",
              "rising-slash",
              "air-slash",
              "dash",
              "bind",
              "hurt",
              "defeat",
              "turn",
              "brake",
            ]
          : [
              "idle",
              "walk",
              "windup",
              "strike",
              "recover",
              "bound",
              "hurt",
              "defeat",
              ...(kind === "guardian" ? ["slam-warn", "slam"] : []),
            ];
      const sheet = document.createElement("canvas");
      sheet.width = 1320;
      sheet.height = actions.length * 245;
      const c = sheet.getContext("2d");
      c.fillStyle = "#193b3e";
      c.fillRect(0, 0, sheet.width, sheet.height);
      const actor = new ActionActor(s, kind);
      for (let row = 0; row < actions.length; row++) {
        const action = actions[row],
          clip = getClip(actor.rig, action);
        c.font = "16px sans-serif";
        c.fillStyle = "#e5dfb8";
        c.fillText(`${kind} / ${action}`, 12, row * 245 + 22);
        for (let frame = 0; frame < 6; frame++) {
          const progress = frame / 5;
          actor.reset();
          const moving = action === "walk" || action === "run";
          const input = {
            x: 110 - (moving ? progress * actor.rig.stride : 0),
            y: 215,
            clock: 0,
            facing: 1,
            action,
            age: 0,
            vx: moving ? 160 : 0,
            grounded: !["launch", "rise", "apex", "fall", "air-slash"].includes(
              action,
            ),
          };
          actor.draw(input);
          actor.reset();
          if (moving) actor.draw(input);
          actor.draw({
            ...input,
            x: 110,
            clock: 1 + clip.duration * progress,
            age: clip.duration * progress,
          });
          const corners = actor.snapshot().corners;
          const minX = Math.min(...corners.map((p) => p.x)),
            maxX = Math.max(...corners.map((p) => p.x));
          const minY = Math.min(...corners.map((p) => p.y)),
            maxY = Math.max(...corners.map((p) => p.y));
          // Pose sheets fit each authored silhouette; gameplay comparison videos
          // retain a fixed camera instead. Include wing and weapon extremes.
          s.cameras.main
            .setZoom(
              Math.min(
                kind === "guardian" ? 1 : 2,
                200 / (maxX - minX),
                200 / (maxY - minY),
              ),
            )
            .centerOn(110 + (minX + maxX) / 2, 215 + (minY + maxY) / 2);
          g.renderer.preRender();
          s.sys.render(g.renderer);
          g.renderer.postRender();
          c.drawImage(
            g.canvas,
            0,
            0,
            220,
            240,
            frame * 220,
            row * 245 + 25,
            220,
            220,
          );
        }
      }
      actor.setVisible(false);
      result[kind] = sheet.toDataURL().split(",")[1];
    }
    return result;
  });
  mkdirSync(output, { recursive: true });
  for (const [name, data] of Object.entries(sheets))
    writeFileSync(`${output}/${name}.png`, Buffer.from(data, "base64"));
} finally {
  await browser.close();
}
