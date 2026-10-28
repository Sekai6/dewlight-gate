import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const out = process.env.ACTION_A_OUTPUT || "artifacts/action-a-round3";
mkdirSync(out, { recursive: true });
const results = [];
for (const variant of ["before", "after"])
  for (const scenario of ["hero", "moss", "moth", "guardian"]) {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      await page.goto(`http://127.0.0.1:${variant === "before" ? 5177 : 5173}`);
      await page.locator("#quality").selectOption("dream");
      await page
        .getByRole("button", { name: "\u5f00\u542f\u65c5\u7a0b" })
        .click();
      await page.evaluate(
        ({ scenario }) => {
          const g = window.dewlight,
            s = g.scene.getScene("journey");
          s.guideEnabled = false;
          const e = s.enemies.find(
            (e) => e.type === (scenario === "moss" ? 0 : 1),
          );
          let x =
            scenario === "hero" ? 420 : scenario === "guardian" ? 2850 : e.x;
          let y =
            scenario === "hero" || scenario === "guardian" ? 1100 : e.floor;
          if (scenario === "guardian")
            for (const p of s.layout.prisms.filter((p) => p.room === 0))
              s.activatePrism(p);
          s.x = x - 110;
          s.y = y;
          s.vx = 0;
          s.vy = 0;
          s.hp = 5;
          s.hurtAt = s.clock + 10000;
          s.safe = { x: s.x, y };
          const actor =
            scenario === "hero"
              ? s.art.actor
              : scenario === "guardian"
                ? s.guardianArt.actor
                : s.creatures.actors[s.enemies.indexOf(e)];
          s.framing.update = () => ({ zoom: 1.7, x: x - 380, y: y - 420 });
          const draw = actor.draw.bind(actor);
          const start = s.clock;
          actor.draw = (input) => {
            const t = s.clock - start,
              cycle = Math.floor(t / 3),
              age = t % 3;
            const actions =
              scenario === "hero"
                ? ["run", "slash", "rising-slash", "air-slash", "dash", "hurt"]
                : scenario === "guardian"
                  ? ["walk", "windup", "strike", "slam-warn", "slam", "recover"]
                  : ["walk", "windup", "strike", "recover", "hurt", "bound"];
            const slot = Math.floor(age / 0.5),
              action = actions[slot],
              phase = age - slot * 0.5;
            const dx =
              scenario === "hero" ? Math.sin(t * 2) * 70 : Math.sin(t) * 30;
            draw({
              ...input,
              x: x + dx,
              y: y - (action === "air-slash" ? 30 : 0),
              clock: s.clock,
              action,
              age: phase,
              instance: cycle * 6 + slot,
              facing: 1,
              vx:
                scenario === "hero" ? Math.cos(t * 2) * 140 : Math.cos(t) * 30,
              vy: 0,
              grounded: action !== "air-slash",
              visible: true,
            });
          };
          window.benchmarkActors = [
            s.art.actor,
            ...s.creatures.actors,
            s.guardianArt.actor,
          ].filter(Boolean);
        },
        { scenario },
      );
      await page.waitForTimeout(2000);
      const report = await page.evaluate(async () => {
        const g = window.dewlight,
          s = g.scene.getScene("journey"),
          cpu = [],
          frame = [],
          animation = [],
          render = [];
        let start = 0,
          at = 0,
          animCost = 0;
        for (const actor of window.benchmarkActors) {
          const original = actor.draw.bind(actor);
          actor.draw = (...args) => {
            const t = performance.now();
            const r = original(...args);
            animCost += performance.now() - t;
            return r;
          };
        }
        const count = () => ({
          textures: g.textures.getTextureKeys().length,
          objects: s.children.list.length,
        });
        const initial = count();
        const pre = () => {
            start = performance.now();
            animCost = 0;
          },
          prerender = () => (at = performance.now()),
          post = () => {
            render.push(performance.now() - at);
            cpu.push(performance.now() - start);
            animation.push(animCost);
          };
        g.events.on("prestep", pre);
        g.events.on("prerender", prerender);
        g.events.on("postrender", post);
        let prev = 0;
        for (let i = 0; i < 360; i++)
          await new Promise((resolve) =>
            requestAnimationFrame((t) => {
              if (prev) frame.push(t - prev);
              prev = t;
              resolve();
            }),
          );
        g.events.off("prestep", pre);
        g.events.off("prerender", prerender);
        g.events.off("postrender", post);
        const p95 = (a) =>
          [...a].sort((a, b) => a - b)[Math.floor((a.length - 1) * 0.95)];
        return {
          cpuP95: p95(cpu),
          animationP95: p95(animation),
          renderP95: p95(render),
          frameP95: p95(frame),
          samples: cpu.length,
          initial,
          final: count(),
        };
      });
      const cdp = await page.context().newCDPSession(page);
      const buffersBefore = await page.evaluate(async () => {
        const core = await import("/src/action-a/core.ts");
        return core.PoseBuffer?.allocations ?? null;
      });
      await cdp.send("HeapProfiler.startSampling", {
        samplingInterval: 4096,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
      await page.waitForTimeout(2000);
      const { profile } = await cdp.send("HeapProfiler.stopSampling");
      let total = 0,
        animation = 0;
      const walk = (n) => {
        total += n.selfSize;
        if (n.callFrame.url.includes("/action-a/")) animation += n.selfSize;
        for (const c of n.children) walk(c);
      };
      walk(profile.head);
      const buffers = await page.evaluate(async () => {
        const core = await import("/src/action-a/core.ts");
        return core.PoseBuffer?.allocations ?? null;
      });
      results.push({
        variant,
        scenario,
        ...report,
        allocationSample: {
          durationMs: 2000,
          samplingInterval: 4096,
          totalBytes: total,
          actionBytes: animation,
        },
        poseBuffers: buffers,
        newPoseBuffers: buffersBefore === null ? null : buffers - buffersBefore,
      });
      console.log(JSON.stringify(results.at(-1)));
    } finally {
      await browser.close();
    }
  }
const comparison = ["hero", "moss", "moth", "guardian"].map((scenario) => {
  const before = results.find(
      (r) => r.variant === "before" && r.scenario === scenario,
    ),
    after = results.find(
      (r) => r.variant === "after" && r.scenario === scenario,
    );
  return {
    scenario,
    cpuP95Ratio: after.cpuP95 / before.cpuP95,
    frameP95Ratio: after.frameP95 / before.frameP95,
    withinCpuBudget: after.cpuP95 <= before.cpuP95 * 1.1,
    withinFrameBudget: after.frameP95 <= before.frameP95 * 1.05,
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
      warmupMs: 2000,
      results,
      comparison,
      note: "Sequential same-machine headless Chromium. Actor actions follow a reproducible 3s cycle; whole game simulation and rendering remain active. Heap sampling is a separate 2s pass including collected objects; bytes are estimates, not exact totals. Main CPU spans prestep to postrender; animation includes constraints and effects; render includes Canvas compositing and scene draws. PoseBuffer counter is exact for buffer construction only.",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(comparison));
if (
  comparison.some(
    (c) =>
      !c.withinCpuBudget ||
      !c.withinFrameBudget ||
      !c.stableObjects ||
      !c.stableTextures,
  )
)
  process.exitCode = 1;
