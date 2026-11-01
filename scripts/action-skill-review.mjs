import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
const variant = process.env.ACTION_A_VARIANT || "after";
const url = process.env.PLAY_URL || "http://127.0.0.1:5173";
const dir = `artifacts/action-skill/${variant}`;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const resumeFrom = Number(process.env.SKILL_CAPTURE_RESUME || 0);
const only = process.env.SKILL_CAPTURE_ONLY;
const records =
  only !== undefined
    ? JSON.parse(readFileSync(`${dir}/capture.json`, "utf8")).records
    : resumeFrom
      ? JSON.parse(readFileSync(`${dir}/capture.json`, "utf8")).records.slice(
          0,
          resumeFrom,
        )
      : [];
const scenes = [
  { id: "hero", title: "主控 · Q → R → F 剑舞连携", seconds: 3 },
  { id: "moss", title: "苔影 · 上挑与落地恢复", seconds: 3 },
  { id: "moth", title: "玻璃蛾 · 失衡上浮与恢复", seconds: 3 },
  ...["normal", "challenge"].flatMap((difficulty) =>
    ["charge", "slam", "crystal", "garden", "radiance"].map((id, index) => ({
      id,
      index,
      difficulty,
      title: `守卫 · ${difficulty === "normal" ? "普通" : "挑战"} · ${["冲锋", "根浪", "折冠散晶", "根庭绽刺", "露冠辉落"][index]}`,
      seconds: id === "crystal" ? 5 : 4,
    })),
  ),
];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    let seed = 101;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  await page.goto(url);
  await page.locator('[data-action="new"]').click();
  await page.evaluate(() => {
    window.dewlight.loop.sleep();
    document.querySelector("#ui").style.display = "none";
    const label = document.createElement("div");
    label.id = "capture-label";
    label.style.cssText =
      "position:fixed;left:24px;top:24px;color:#f5edc9;background:#163b3fe0;padding:15px;font:20px system-ui;z-index:100";
    document.body.append(label);
  });
  const ffmpeg = execFileSync(
    "python",
    ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
    { encoding: "utf8" },
  ).trim();
  for (const [index, scene] of scenes.entries()) {
    if (only !== undefined && index !== Number(only)) continue;
    if (index < resumeFrom) continue;
    const start = await page.evaluate(
      ({ scene, variant }) => {
        const s = window.dewlight.scene.getScene("journey");
        s.resetAnimations();
        s.effects.reset();
        s.clearInput();
        Object.assign(s, {
          clock: 0,
          x: 400,
          y: 1100,
          vx: 0,
          vy: 0,
          energy: 100,
          hp: 5,
          hurtAt: 999,
          dashAt: -999,
          bindAt: -999,
          attackAt: -999,
          facing: 1,
          onGround: true,
          groundIndex: -1,
          guideEnabled: false,
          training: false,
        });
        const isBoss = scene.difficulty !== undefined;
        if (scene.id === "moss" || scene.id === "moth") {
          const e = s.enemies.find(
            (e) => e.type === (scene.id === "moth" ? 1 : 0),
          );
          Object.assign(e, {
            hp: 2,
            phase: "patrol",
            phaseAt: 0,
            hurtAt: -999,
            bound: 0,
            cool: 999,
            liftVy: undefined,
            liftOffset: 0,
          });
          s.x = e.x - 75;
          s.y = e.floor;
        }
        if (isBoss) {
          for (const p of s.layout.prisms.filter((p) => p.room === 0))
            s.activatePrism(p);
          s.x = 2650;
          s.y = 1100;
          const b = s.guardian;
          const originalMaxHp = b.hp;
          Object.assign(b, {
            phase: "stalk",
            until: 0.1,
            phaseAt: 0,
            x: 2920,
            facing: -1,
            difficulty: scene.difficulty,
            maxHp: scene.difficulty === "challenge" ? 64 : 48,
            hp:
              variant === "before"
                ? scene.id === "radiance"
                  ? originalMaxHp / 2
                  : originalMaxHp
                : scene.id === "radiance"
                  ? scene.difficulty === "challenge"
                    ? 32
                    : 24
                  : scene.difficulty === "challenge"
                    ? 64
                    : 48,
            attacks: { charge: 0, slam: 1, crystal: 2, garden: 3, radiance: 3 }[
              scene.id
            ],
            hazards: [],
            wave: [],
            nextCombo: undefined,
          });
        }
        s.safe = { x: s.x, y: s.y };
        const left = isBoss ? 2350 : s.x - 170;
        s.framing.update = () => ({
          zoom: isBoss ? 1.4 : 2.4,
          x: left,
          y: 1100 - (800 / (isBoss ? 1.4 : 2.4)) * 0.8,
        });
        document.getElementById("capture-label").textContent =
          `${variant.toUpperCase()} · ${scene.title} · 120 Hz / 30 fps`;
        s.draw();
        return { x: s.x, y: s.y };
      },
      { scene, variant },
    );
    const frames = scene.seconds * 30,
      keyframes = [];
    for (let frame = 0; frame < frames; frame++) {
      const telemetry = await page.evaluate(
        ({ frame, scene }) => {
          const g = window.dewlight,
            s = g.scene.getScene("journey");
          for (let sub = 0; sub < 4; sub++) {
            const tick = frame * 4 + sub;
            if (scene.id === "hero") {
              if (tick === 12) s.pendingKeys.add("Q");
              if (tick === 35) s.pendingKeys.add("R");
              if (tick === 73) s.pendingKeys.add("F");
            } else if (
              (scene.id === "moss" || scene.id === "moth") &&
              tick === 24
            )
              s.pendingKeys.add("R");
            s.clock += 1 / 120;
            s.step(1 / 120);
            s.draw();
          }
          g.renderer.preRender();
          s.sys.render(g.renderer);
          g.renderer.postRender();
          return {
            frame,
            x: s.x,
            y: s.y,
            energy: s.energy,
            skill: s.skills?.pose,
            boss: s.guardian.phase,
            hazards: s.guardian.hazards?.length ?? 0,
          };
        },
        { frame, scene },
      );
      if (frame % 6 === 0) keyframes.push(telemetry);
      const path = `${dir}/frame-${String(frame).padStart(4, "0")}.png`;
      await page.screenshot({ path });
      if ([5, 9, 14, 19, 27, 40, 60].includes(frame))
        await page.screenshot({
          path: `${dir}/${index}-${scene.id}-${frame}.png`,
        });
    }
    const filename = `${String(index).padStart(2, "0")}-${scene.id}${scene.difficulty ? `-${scene.difficulty}` : ""}.webm`;
    execFileSync(
      ffmpeg,
      [
        "-y",
        "-framerate",
        "30",
        "-i",
        `${dir}/frame-%04d.png`,
        "-frames:v",
        String(frames),
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "30",
        "-b:v",
        "0",
        "-pix_fmt",
        "yuv420p",
        `${dir}/${filename}`,
      ],
      { stdio: "ignore" },
    );
    for (let frame = 0; frame < frames; frame++)
      unlinkSync(`${dir}/frame-${String(frame).padStart(4, "0")}.png`);
    records[index] = {
      ...scene,
      filename,
      start,
      frames,
      telemetry: keyframes,
    };
    writeFileSync(
      `${dir}/capture.json`,
      JSON.stringify(
        {
          variant,
          baseline: "v1.3.0",
          simulationHz: 120,
          animationHz: 120,
          renderHz: 30,
          fixedCamera: true,
          errors,
          records,
        },
        null,
        2,
      ),
    );
    console.log(`${variant}: ${filename}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}
