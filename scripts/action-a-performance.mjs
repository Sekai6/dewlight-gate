import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const out = process.env.ACTION_A_OUTPUT || "artifacts/action-a";
mkdirSync(out, { recursive: true });
const results = [];
for (const variant of ["before", "after"])
  for (const encounter of [false, true]) {
    const b = await chromium.launch();
    try {
      const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
      await p.goto(
        `http://127.0.0.1:${variant === "before" ? process.env.BASELINE_PORT || 5175 : 5173}`,
      );
      await p.getByLabel("画质", { exact: true }).selectOption("dream");
      await p.getByRole("button", { name: "开启旅程" }).click();
      if (encounter)
        await p.evaluate(() => {
          const s = window.dewlight.scene.getScene("journey"),
            e = s.enemies.find((e) => e.type === 1);
          s.x = e.x - 160;
          s.y = e.floor;
          s.vy = 0;
          s.hurtAt = s.clock + 100;
        });
      await p.waitForTimeout(1500);
      const report = await p.evaluate(async () => {
        const g = window.dewlight,
          cpu = [],
          frame = [],
          update = [],
          render = [];
        let updateAt = 0,
          renderAt = 0;
        const beforeUpdate = () => {
          updateAt = performance.now();
        };
        const afterUpdate = () => update.push(performance.now() - updateAt);
        const beforeRender = () => {
          renderAt = performance.now();
        };
        const afterRender = () => render.push(performance.now() - renderAt);
        const scene = g.scene.getScene("journey");
        const animation = [];
        let animationCost = 0;
        for (const actor of [
          scene.art.actor,
          ...(scene.creatures.actors ?? []),
          scene.guardianArt.actor,
        ].filter(Boolean)) {
          const original = actor.draw.bind(actor);
          actor.draw = (...args) => {
            const at = performance.now();
            const result = original(...args);
            animationCost += performance.now() - at;
            return result;
          };
        }
        let start = 0;
        const pre = () => {
          start = performance.now();
          animationCost = 0;
        };
        const post = () => {
          cpu.push(performance.now() - start);
          animation.push(animationCost);
        };
        const count = () => {
          let n = 0;
          const visit = (o) => {
            n++;
            if (o.list) for (const child of o.list) visit(child);
          };
          for (const s of g.scene.getScenes(true))
            for (const o of s.children.list) visit(o);
          return { objects: n, textures: g.textures.getTextureKeys().length };
        };
        const initial = count();
        const sceneEvents = g.scene.getScene("journey").events;
        g.events.on("prestep", pre);
        sceneEvents.on("preupdate", beforeUpdate);
        sceneEvents.on("postupdate", afterUpdate);
        g.events.on("prerender", beforeRender);
        g.events.on("postrender", afterRender);
        g.events.on("postrender", post);
        let previous = performance.now();
        for (let i = 0; i < 360; i++)
          await new Promise((resolve) =>
            requestAnimationFrame((time) => {
              frame.push(time - previous);
              previous = time;
              resolve();
            }),
          );
        g.events.off("prestep", pre);
        sceneEvents.off("preupdate", beforeUpdate);
        sceneEvents.off("postupdate", afterUpdate);
        g.events.off("prerender", beforeRender);
        g.events.off("postrender", afterRender);
        g.events.off("postrender", post);
        const pct = (a, p) =>
          [...a].sort((a, b) => a - b)[Math.floor((a.length - 1) * p)];
        return {
          cpuP95: pct(cpu, 0.95),
          animationP95: pct(animation, 0.95),
          updateP95: pct(update, 0.95),
          renderP95: pct(render, 0.95),
          frameP95: pct(frame, 0.95),
          frameMedian: pct(frame, 0.5),
          samples: cpu.length,
          initial,
          final: count(),
        };
      });
      results.push({
        variant,
        scenario: encounter ? "moth encounter" : "safe opening",
        ...report,
      });
    } finally {
      await b.close();
    }
  }
const comparison = [false, true].map((encounter) => {
  const before = results[encounter ? 1 : 0],
    after = results[encounter ? 3 : 2];
  return {
    scenario: after.scenario,
    frameP95Ratio: after.frameP95 / before.frameP95,
    cpuP95Ratio: after.cpuP95 / before.cpuP95,
    withinFrameBudget: after.frameP95 <= before.frameP95 + 0.2,
    cpuImproved: after.cpuP95 <= before.cpuP95 * 0.7,
    stableObjects: after.initial.objects === after.final.objects,
    stableTextures: after.initial.textures === after.final.textures,
  };
});
writeFileSync(
  `${out}/performance.json`,
  JSON.stringify(
    {
      viewport: [1440, 900],
      quality: "dream",
      recordVideo: false,
      results,
      comparison,
      note: "Sequential headless Chromium on the same machine; frame timing includes scheduling and is not a hardware guarantee.",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ results, comparison }));
if (
  comparison.some(
    (c) =>
      !c.withinFrameBudget ||
      !c.stableObjects ||
      !c.stableTextures ||
      (process.env.REQUIRE_CPU_GAIN === "1" && !c.cpuImproved),
  )
)
  process.exitCode = 1;
