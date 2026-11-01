import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const out = process.env.ACTION_A_OUTPUT || "artifacts/action-a-round6";
mkdirSync(out, { recursive: true });
const results = [];
for (let round = 0; round < 3; round++)
  for (const variant of ["before", "after"])
    for (const scenario of ["hero", "platform", "knock", "guardian"]) {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 900 },
        });
        await page.goto(
          `http://127.0.0.1:${variant === "before" ? 5180 : 5173}`,
        );
        await page.locator("#quality").selectOption("dream");
        await page
          .getByRole("button", { name: "\u5f00\u542f\u65c5\u7a0b" })
          .click();
        await page.evaluate(
          ({ scenario }) => {
            const g = window.dewlight,
              s = g.scene.getScene("journey");
            s.guideEnabled = false;
            s.x = 400;
            s.y = 1100;
            s.vx = 0;
            s.vy = 0;
            s.safe = { x: 400, y: 1100 };
            if (scenario === "guardian") {
              for (const p of s.layout.prisms.filter((p) => p.room === 0))
                s.activatePrism(p);
              s.x = 2700;
              s.safe = { x: 2700, y: 1100 };
              s.hurtAt = s.clock + 1000;
            }
            s.framing.update = () => ({
              zoom: 1.7,
              x: scenario === "guardian" ? 2400 : 100,
              y: 680,
            });
            window.benchmarkActors =
              scenario === "guardian"
                ? [s.art.actor, s.guardianArt.actor]
                : [s.art.actor];
            if (scenario === "hero" || scenario === "platform") {
              const actor = s.art.actor,
                draw = actor.draw.bind(actor),
                start = s.clock;
              actor.draw = (input) => {
                const t = s.clock - start,
                  cycle = t % 2.4,
                  dir = cycle < 1.2 ? 1 : -1;
                const moving = cycle % 1.2 < 0.8,
                  shift = scenario === "platform" ? Math.sin(t) * 25 : 0;
                draw({
                  ...input,
                  x: 400 + Math.sin(t * 2) * 55 + shift,
                  y: 1100 + (scenario === "platform" ? Math.sin(t) * 12 : 0),
                  vx: moving ? dir * 150 : 0,
                  facing: dir,
                  grounded: true,
                  action:
                    scenario === "platform" && cycle % 1.2 < 0.38
                      ? "slash"
                      : moving
                        ? "run"
                        : "idle",
                  age: cycle % 1.2,
                  instance: `perf:${Math.floor(t / 1.2)}`,
                  support: {
                    id: "perf",
                    x: shift,
                    y: 1100 + (scenario === "platform" ? Math.sin(t) * 12 : 0),
                    left: 200,
                    right: 800,
                  },
                });
              };
            }
            let next = s.clock + 0.1,
              serial = 0;
            const step = s.step.bind(s);
            s.step = (dt) => {
              if (scenario !== "guardian" && s.clock >= next) {
                next = s.clock + 2.6;
                s.x = 400;
                s.y = 1100;
                s.vx = 0;
                s.vy = 0;
                s.hp = 5;
                s.hurtAt = -999;
                s.dashAt = -999;
                if (scenario === "knock")
                  s.damage(false, 1, {
                    kind: serial % 2 ? "charge" : "wave",
                    sourceX: 350,
                    sourceY: 1100,
                    direction: 1,
                    instance: `perf:${serial++}`,
                  });
              }
              step(dt);
            };
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
            constraints = [],
            evaluation = [],
            render = [];
          let start = 0,
            at = 0,
            animCost = 0,
            constraintCost = 0;
          for (const actor of window.benchmarkActors) {
            for (const name of ["solveFeet", "solveWeapon", "applyDoll"])
              if (actor[name]) {
                const original = actor[name].bind(actor);
                actor[name] = (...args) => {
                  const t = performance.now();
                  const result = original(...args);
                  constraintCost += performance.now() - t;
                  return result;
                };
              }
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
              constraintCost = 0;
            },
            prerender = () => (at = performance.now()),
            post = () => {
              render.push(performance.now() - at);
              cpu.push(performance.now() - start);
              animation.push(animCost);
              constraints.push(constraintCost);
              evaluation.push(Math.max(0, animCost - constraintCost));
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
            raw: { cpu, frame, animation, constraints, evaluation, render },
            cpuP95: p95(cpu),
            animationP95: p95(animation),
            constraintsP95: p95(constraints),
            evaluationP95: p95(evaluation),
            renderP95: p95(render),
            frameP95: p95(frame),
            samples: cpu.length,
            initial,
            final: count(),
          };
        });
        const cdp = await page.context().newCDPSession(page);
        const buffersBefore = await page.evaluate(async () => {
          return window.benchmarkActors[0].composed.constructor.allocations;
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
          return window.benchmarkActors[0].composed.constructor.allocations;
        });
        results.push({
          round,
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
          newPoseBuffers:
            buffersBefore === null ? null : buffers - buffersBefore,
        });
        console.log(
          JSON.stringify({
            round,
            variant,
            scenario,
            cpuP95: report.cpuP95,
            frameP95: report.frameP95,
          }),
        );
        writeFileSync(
          `${out}/performance-progress.json`,
          JSON.stringify(results, null, 2),
        );
      } finally {
        await browser.close();
      }
    }
const median = (values) => [...values].sort((a, b) => a - b)[1];
const comparison = ["hero", "platform", "knock", "guardian"].map((scenario) => {
  const before = results.filter(
      (r) => r.variant === "before" && r.scenario === scenario,
    ),
    after = results.filter(
      (r) => r.variant === "after" && r.scenario === scenario,
    );
  const cpuBefore = median(before.map((r) => r.cpuP95)),
    cpuAfter = median(after.map((r) => r.cpuP95));
  const frameBefore = median(before.map((r) => r.frameP95)),
    frameAfter = median(after.map((r) => r.frameP95));
  return {
    scenario,
    cpuBefore,
    cpuAfter,
    frameBefore,
    frameAfter,
    cpuP95Ratio: cpuAfter / cpuBefore,
    frameP95Ratio: frameAfter / frameBefore,
    withinCpuBudget: cpuAfter <= cpuBefore * 1.1,
    withinFrameBudget: frameAfter <= frameBefore * 1.05,
    stableObjects: after.every((r) => r.initial.objects === r.final.objects),
    stableTextures: after.every((r) => r.initial.textures === r.final.textures),
  };
});
writeFileSync(
  `${out}/performance.json`,
  JSON.stringify(
    {
      viewport: [1440, 900],
      quality: "dream",
      warmupMs: 2000,
      pairedRounds: 3,
      aggregation: "median of three P95 measurements",
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
